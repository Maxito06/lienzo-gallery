import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Sin base de datos ni servicios externos: un monitor puede mantener despierta la API sin gastar cómputo de Neon
  @Get()
  @Header('Cache-Control', 'no-store')
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
}
