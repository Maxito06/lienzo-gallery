import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from './prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: 'ok' };
  }

  @Get('db')
  async checkDb() {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      dbLatencyMs: Date.now() - start,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }

  // TEMPORAL TEC-13: borrar al terminar la prueba
  @Get('cookie-set')
  cookieSet(@Res({ passthrough: true }) res: Response) {
    res.setHeader(
      'Set-Cookie',
      '__Host-smoke=ok; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300',
    );
    res.setHeader('Cache-Control', 'no-store');
    return { set: true, at: new Date().toISOString() };
  }

  // TEMPORAL TEC-13: borrar al terminar la prueba
  @Get('cookie-check')
  cookieCheck(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return {
      received: Boolean(
        req.headers.cookie && req.headers.cookie.includes('__Host-smoke=ok'),
      ),
    };
  }

  // TEMPORAL TEC-13: borrar al terminar la prueba
  @Get('time')
  time(@Res({ passthrough: true }) res: Response) {
    return { now: new Date().toISOString() };
  }
}
