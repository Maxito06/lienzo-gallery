import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

const PASSWORD = 'correct-horse-battery';
const CSRF = 'lienzo-web';

describe('Auth (e2e)', () => {
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

    email = `auth-test-${randomUUID()}@example.com`;
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

  // supertest no reenvía cookies Secure por HTTP: se arma la cabecera a mano
  const login = async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Requested-With', CSRF)
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookie = (setCookieOf(response)[0] as string).split(';')[0] as string;
    return { response, cookie };
  };

  it('login succeeds and sets a hardened session cookie', async () => {
    const { response } = await login();
    expect(response.body).toEqual({ admin: { id: adminUserId, email } });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const setCookie = setCookieOf(response)[0] as string;
    expect(setCookie.startsWith('__Host-session=')).toBe(true);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toContain('Domain');
    expect(response.headers['cache-control']).toBe('no-store');

    await expect(prisma.adminSession.count({ where: { adminUserId } })).resolves.toBe(1);
  });

  it('login rejects a wrong password and an unknown email with the same response', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Requested-With', CSRF)
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Requested-With', CSRF)
      .send({ email: `nobody-${randomUUID()}@example.com`, password: PASSWORD })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    expect(unknownEmail.headers['set-cookie']).toBeUndefined();
    await expect(prisma.adminSession.count({ where: { adminUserId } })).resolves.toBe(0);
  });

  it('login rejects malformed bodies', async () => {
    const bodies: unknown[] = [
      {},
      { email },
      { email: 123, password: PASSWORD },
      { email: '', password: PASSWORD },
      { email, password: '' },
      { email, password: 'a'.repeat(1025) },
      { email: 'a'.repeat(255), password: PASSWORD },
    ];
    for (const body of bodies) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Requested-With', CSRF)
        .send(body as object)
        .expect(400);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('me returns the admin with a valid cookie', async () => {
    const { cookie } = await login();
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual({ admin: { id: adminUserId, email } });
  });

  it('me rejects missing, malformed and unknown cookies', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', '__Host-session=basura')
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `__Host-session=${randomUUID()}.abc`)
      .expect(401);
  });

  it('me rejects a session idle for more than 30 minutes', async () => {
    const { cookie } = await login();
    await prisma.adminSession.updateMany({
      where: { adminUserId },
      data: { lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('logout revokes the session and clears the cookie', async () => {
    const { cookie } = await login();
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-Requested-With', CSRF)
      .set('Cookie', cookie)
      .expect(204);
    expect((setCookieOf(response)[0] as string).startsWith('__Host-session=;')).toBe(true);

    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('logout without a cookie is harmless', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-Requested-With', CSRF)
      .expect(204);
  });
});
