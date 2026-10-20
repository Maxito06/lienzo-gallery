import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min sin actividad
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 h máximo
export const LAST_SEEN_UPDATE_MS = 60 * 1000; // no escribir lastSeenAt más de una vez por minuto

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hash sha256 en hexadecimal del secreto
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

// Separa "id.secreto"; devuelve null si el formato es inválido
function parseToken(token: string): { id: string; secret: string } | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [id, secret] = parts as [string, string];
  if (!UUID_REGEX.test(id) || secret.length === 0) return null;
  return { id, secret };
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    adminUserId: string,
    now: Date = new Date(),
  ): Promise<{ token: string; expiresAt: Date }> {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);

    await this.prisma.adminSession.create({
      data: {
        id,
        secretHash: hashSecret(secret),
        adminUserId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
      },
    });

    return { token: `${id}.${secret}`, expiresAt };
  }

  async validate(
    token: string,
    now: Date = new Date(),
  ): Promise<{ sessionId: string; adminUserId: string } | null> {
    const parsed = parseToken(token);
    if (!parsed) return null;

    const session = await this.prisma.adminSession.findUnique({ where: { id: parsed.id } });
    if (!session) return null;

    const expected = Buffer.from(session.secretHash, 'utf8');
    const received = Buffer.from(hashSecret(parsed.secret), 'utf8');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return null;
    }

    const idleMs = now.getTime() - session.lastSeenAt.getTime();
    if (now.getTime() >= session.expiresAt.getTime() || idleMs >= IDLE_TIMEOUT_MS) {
      await this.prisma.adminSession.deleteMany({ where: { id: session.id } });
      return null;
    }

    if (idleMs > LAST_SEEN_UPDATE_MS) {
      await this.prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }

    return { sessionId: session.id, adminUserId: session.adminUserId };
  }

  async revoke(token: string): Promise<void> {
    const parsed = parseToken(token);
    if (!parsed) return;

    await this.prisma.adminSession.deleteMany({
      where: { id: parsed.id, secretHash: hashSecret(parsed.secret) },
    });
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.adminSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { lastSeenAt: { lte: new Date(now.getTime() - IDLE_TIMEOUT_MS) } },
        ],
      },
    });
    return result.count;
  }
}
