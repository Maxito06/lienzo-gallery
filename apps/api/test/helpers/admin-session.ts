import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { SESSION_COOKIE_NAME } from '../../src/auth/cookies.js';
import { SessionsService } from '../../src/auth/sessions.service.js';
import { PrismaService } from '../../src/prisma.service.js';

// Crea un administrador de prueba con una sesión válida lista para usar como cookie
export async function createAdminSession(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const sessions = app.get(SessionsService);

  const adminUser = await prisma.adminUser.create({
    data: { email: `helper-${randomUUID()}@example.com`, passwordHash: 'not-a-real-hash' },
  });
  const { token } = await sessions.create(adminUser.id);

  return {
    adminUserId: adminUser.id,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
    // Las sesiones caen en cascada al borrar el usuario
    cleanup: async (): Promise<void> => {
      await prisma.adminUser.delete({ where: { id: adminUser.id } });
    },
  };
}
