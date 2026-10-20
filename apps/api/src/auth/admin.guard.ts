import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME, getCookie } from './cookies.js';
import { SessionsService } from './sessions.service.js';

export type AdminRequest = Request & { admin: { adminUserId: string; sessionId: string } };

// Exige una sesión de administrador válida y la deja en req.admin
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');

    const token = getCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) throw new UnauthorizedException();

    const session = await this.sessions.validate(token);
    if (!session) throw new UnauthorizedException();

    (req as AdminRequest).admin = session;
    return true;
  }
}
