import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { HttpBackend } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { ApiOriginBackend } from './core/api-origin.backend';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Solo en el servidor; al fusionar, este proveedor va después del de withFetch() y prevalece
    { provide: HttpBackend, useClass: ApiOriginBackend },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
