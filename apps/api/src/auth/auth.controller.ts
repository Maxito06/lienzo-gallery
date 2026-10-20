import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma.service.js';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, getCookie } from './cookies.js';
import { SessionsService } from './sessions.service.js';

@Controller('auth')
export class AuthController {
  // Hash falso para igualar tiempos cuando el email no existe
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException('Invalid request');
    }
    const { email: rawEmail, password } = body as Record<string, unknown>;
    if (typeof rawEmail !== 'string' || typeof password !== 'string') {
      throw new BadRequestException('Invalid request');
    }
    const email = rawEmail.trim();
    if (email.length === 0 || email.length > 254 || password.length === 0 || password.length > 1024) {
      throw new BadRequestException('Invalid request');
    }

    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      await argon2.verify(await this.getDummyHash(), password).catch(() => false);
      throw new UnauthorizedException('Invalid credentials');
    }

    let valid = false;
    try {
      valid = await argon2.verify(user.passwordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { token, expiresAt } = await this.sessions.create(user.id);
    res.cookie(SESSION_COOKIE_NAME, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
    res.setHeader('Cache-Control', 'no-store');
    return { admin: { id: user.id, email: user.email } };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (token) {
      await this.sessions.revoke(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    res.setHeader('Cache-Control', 'no-store');
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const token = getCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) throw new UnauthorizedException();

    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException();

    const user = await this.prisma.adminUser.findUnique({ where: { id: session.adminUserId } });
    if (!user) throw new UnauthorizedException();

    return { admin: { id: user.id, email: user.email } };
  }
}
