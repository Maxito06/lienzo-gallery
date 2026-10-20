import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TechniquesController } from './admin/techniques.controller.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { LoginRateLimiter } from './auth/login-rate-limiter.js';
import { SessionsService } from './auth/sessions.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController, HealthController, AuthController, TechniquesController],
  providers: [
    AppService,
    PrismaService,
    SessionsService,
    LoginRateLimiter,
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
