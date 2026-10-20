import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  type OnModuleInit,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma.service.js';
import { type AdminRequest, AdminGuard } from './admin.guard.js';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, getCookie } from './cookies.js';
import { LoginRateLimiter } from './login-rate-limiter.js';
import { SessionsService } from './sessions.service.js';

@Controller('auth')
export class AuthController implements OnModuleInit {
  // Hash falso para igualar tiempos cuando el email no existe
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(16).toString('hex'));
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

    const retryAfter = this.limiter.retryAfterSeconds(email);
    if (retryAfter > 0) {
      res.setHeader('Retry-After', String(retryAfter));
      throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Se cuenta el intento antes de verificar para que las peticiones en paralelo no salten el límite
    this.limiter.recordFailure(email);

    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      await argon2.verify(this.dummyHash, password).catch(() => false);
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

    this.limiter.reset(email);
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
  @UseGuards(AdminGuard)
  async me(@Req() req: AdminRequest) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: req.admin.adminUserId } });
    if (!user) throw new UnauthorizedException();

    return { admin: { id: user.id, email: user.email } };
  }
}
