import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export const CSRF_HEADER_NAME = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'lienzo-web';

// Exige una cabecera personalizada en peticiones que cambian estado
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return true;
    }
    if (req.headers[CSRF_HEADER_NAME] !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException('Missing CSRF header');
    }
    return true;
  }
}
