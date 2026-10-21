import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ArtworksController } from './admin/artworks.controller.js';
import { ArtworkImagesController } from './admin/artwork-images.controller.js';
import { SeriesController } from './admin/series.controller.js';
import { TechniquesController } from './admin/techniques.controller.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { CloudinaryService } from './cloudinary/cloudinary.service.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { LoginRateLimiter } from './auth/login-rate-limiter.js';
import { SessionsService } from './auth/sessions.service.js';
import { PrismaService } from './prisma.service.js';
import { PublicCatalogService } from './public/public-catalog.service.js';
import { PublicController } from './public/public.controller.js';
import { ServerErrorFilter } from './common/server-error.filter.js';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [
    AppController,
    HealthController,
    AuthController,
    TechniquesController,
    SeriesController,
    ArtworksController,
    ArtworkImagesController,
    PublicController,
  ],
  providers: [
    AppService,
    PrismaService,
    SessionsService,
    LoginRateLimiter,
    PublicCatalogService,
    CloudinaryService,
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: ServerErrorFilter },
  ],
})
export class AppModule {}
