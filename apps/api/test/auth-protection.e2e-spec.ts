import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

const PASSWORD = 'correct-horse-battery';
const CSRF = 'lienzo-web';

describe('Auth protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminUserId: string;
  let email: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    email = `protect-test-${randomUUID()}@example.com`;
    const user = await prisma.adminUser.create({
      data: { email, passwordHash: await argon2.hash(PASSWORD) },
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

  const setCookieOf = (response: request.Response): string[] => {
    const header = response.headers['set-cookie'] as unknown;
    return Array.isArray(header) ? (header as string[]) : [];
  };

  const postLogin = (loginEmail: string, password: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Requested-With', CSRF)
      .send({ email: loginEmail, password });

  describe('CSRF', () => {
    it('rejects a state-changing request without the CSRF header', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(403);
      expect(response.headers['set-cookie']).toBeUndefined();
      await expect(prisma.adminSession.count({ where: { adminUserId } })).resolves.toBe(0);
    });

    it('rejects a state-changing request with a wrong CSRF header value', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Requested-With', 'something-else')
        .send({ email, password: PASSWORD })
        .expect(403);
    });

    it('does not require the CSRF header on safe methods', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });

    it('logout without the CSRF header does not revoke the session', async () => {
      const loginResponse = await postLogin(email, PASSWORD).expect(200);
      const cookie = (setCookieOf(loginResponse)[0] as string).split(';')[0] as string;

      await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(403);
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(200);
    });
  });

  describe('login rate limit', () => {
    it('locks a login after 5 failures and reports Retry-After', async () => {
      const unknown = `nobody-${randomUUID()}@example.com`;
      for (let i = 0; i < 5; i++) {
        await postLogin(unknown, 'wrong-password').expect(401);
      }
      const response = await postLogin(unknown, 'wrong-password').expect(429);
      const retryAfter = Number(response.headers['retry-after']);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(900);
    });

    it('counts parallel attempts so the limit cannot be bypassed', async () => {
      const unknown = `nobody-${randomUUID()}@example.com`;
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => postLogin(unknown, 'wrong-password')),
      );
      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 401)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    });

    it('a successful login resets the counter', async () => {
      const otherEmail = `protect-test-${randomUUID()}@example.com`;
      const other = await prisma.adminUser.create({
        data: { email: otherEmail, passwordHash: await argon2.hash(PASSWORD) },
      });
      try {
        await postLogin(otherEmail, PASSWORD).expect(200);
        for (let i = 0; i < 4; i++) await postLogin(otherEmail, 'wrong-password').expect(401);
        await postLogin(otherEmail, PASSWORD).expect(200);
        for (let i = 0; i < 4; i++) await postLogin(otherEmail, 'wrong-password').expect(401);
        await postLogin(otherEmail, PASSWORD).expect(200);
      } finally {
        await prisma.adminUser.delete({ where: { id: other.id } });
      }
    });

    it('blocks even the correct password while locked', async () => {
      for (let i = 0; i < 5; i++) {
        await postLogin(email, 'wrong-password').expect(401);
      }
      await postLogin(email, PASSWORD).expect(429);
    });

    it('does not leak whether the email exists when locked', async () => {
      const unknown = `nobody-${randomUUID()}@example.com`;
      // El usuario de prueba ya quedó bloqueado en la prueba anterior; se refuerza por si acaso
      for (let i = 0; i < 5; i++) {
        await postLogin(email, 'wrong-password');
        await postLogin(unknown, 'wrong-password');
      }
      const existing = await postLogin(email, 'wrong-password').expect(429);
      const missing = await postLogin(unknown, 'wrong-password').expect(429);
      expect(existing.body).toEqual(missing.body);
    });
  });

  describe('admin guard', () => {
    it('me responds with no-store even when unauthorized', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(response.headers['cache-control']).toContain('no-store');
    });
  });
});
