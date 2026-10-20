import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { SessionsService } from './auth/sessions.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService, SessionsService],
})
export class AppModule {}
