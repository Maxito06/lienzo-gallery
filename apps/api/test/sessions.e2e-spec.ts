import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  SessionsService,
} from '../src/auth/sessions.service.js';
import { PrismaService } from '../src/prisma.service.js';

const MINUTE = 60 * 1000;
const t0 = new Date('2026-01-01T12:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('Sessions (e2e)', () => {
  let app: INestApplication;
  let sessions: SessionsService;
  let prisma: PrismaService;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    sessions = app.get(SessionsService);
    prisma = app.get(PrismaService);

    const user = await prisma.adminUser.create({
      data: {
        email: `session-test-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    adminUserId = user.id;
  });

  afterEach(async () => {
    await prisma.adminSession.deleteMany({ where: { adminUserId } });
  });

  afterAll(async () => {
    await prisma.adminUser.delete({ where: { id: adminUserId } });
    await app.close();
  });

  it('stores only a hash of the secret', async () => {
    const { token } = await sessions.create(adminUserId, t0);
    const [id, secret] = token.split('.') as [string, string];

    const row = await prisma.adminSession.findUniqueOrThrow({ where: { id } });
    expect(row.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.secretHash).not.toContain(secret);
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it('validates a fresh token', async () => {
    const { token } = await sessions.create(adminUserId, t0);
    const result = await sessions.validate(token, at(MINUTE));
    expect(result?.adminUserId).toBe(adminUserId);
  });

  it('rejects malformed and wrong tokens without throwing', async () => {
    const { token } = await sessions.create(adminUserId, t0);
    const [id] = token.split('.') as [string];

    const invalid = [
      '',
      'abc',
      'a.b.c',
      'not-a-uuid.secret',
      `${id}.wrong-secret`,
      `${randomUUID()}.some-secret`,
    ];
    for (const value of invalid) {
      await expect(sessions.validate(value, at(MINUTE))).resolves.toBeNull();
    }
  });

  it('expires after 30 minutes of inactivity', async () => {
    const first = await sessions.create(adminUserId, t0);
    await expect(sessions.validate(first.token, at(29 * MINUTE))).resolves.not.toBeNull();

    const second = await sessions.create(adminUserId, t0);
    const secondId = second.token.split('.')[0] as string;
    await expect(sessions.validate(second.token, at(IDLE_TIMEOUT_MS))).resolves.toBeNull();
    await expect(prisma.adminSession.findUnique({ where: { id: secondId } })).resolves.toBeNull();
  });

  it('expires after 8 hours even if always active', async () => {
    const { token } = await sessions.create(adminUserId, t0);

    for (let minutes = 20; minutes <= 7 * 60 + 40; minutes += 20) {
      await expect(sessions.validate(token, at(minutes * MINUTE))).resolves.not.toBeNull();
    }
    await expect(sessions.validate(token, at(ABSOLUTE_TIMEOUT_MS))).resolves.toBeNull();
  });

  it('renews lastSeenAt at most once per minute', async () => {
    const { token } = await sessions.create(adminUserId, t0);
    const id = token.split('.')[0] as string;

    await sessions.validate(token, at(10 * MINUTE));
    const renewed = await prisma.adminSession.findUniqueOrThrow({ where: { id } });
    expect(renewed.lastSeenAt.getTime()).toBe(at(10 * MINUTE).getTime());

    await sessions.validate(token, at(10 * MINUTE + 30 * 1000));
    const unchanged = await prisma.adminSession.findUniqueOrThrow({ where: { id } });
    expect(unchanged.lastSeenAt.getTime()).toBe(at(10 * MINUTE).getTime());
  });

  it('revoke deletes the session only with the right secret', async () => {
    const { token } = await sessions.create(adminUserId, t0);
    const [id] = token.split('.') as [string];

    await sessions.revoke(`${id}.wrong-secret`);
    await expect(sessions.validate(token, at(MINUTE))).resolves.not.toBeNull();

    await sessions.revoke(token);
    await expect(sessions.validate(token, at(MINUTE))).resolves.toBeNull();
  });

  it('deleteExpired removes only expired sessions', async () => {
    const expired = await sessions.create(adminUserId, t0);
    const live = await sessions.create(adminUserId, at(60 * MINUTE));
    const now = at(60 * MINUTE + MINUTE);

    await expect(sessions.deleteExpired(now)).resolves.toBe(1);

    const expiredId = expired.token.split('.')[0] as string;
    const liveId = live.token.split('.')[0] as string;
    await expect(prisma.adminSession.findUnique({ where: { id: expiredId } })).resolves.toBeNull();
    await expect(prisma.adminSession.findUnique({ where: { id: liveId } })).resolves.not.toBeNull();
  });

  it('deleting the admin user deletes its sessions', async () => {
    const other = await prisma.adminUser.create({
      data: {
        email: `session-test-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
      },
    });
    const { token } = await sessions.create(other.id, t0);
    const id = token.split('.')[0] as string;

    await prisma.adminUser.delete({ where: { id: other.id } });
    await expect(prisma.adminSession.findUnique({ where: { id } })).resolves.toBeNull();
  });
});
