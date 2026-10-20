import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { apiOriginInterceptor } from './core/api-origin.interceptor';
import { csrfInterceptor } from './core/csrf.interceptor';
import { sessionExpiredInterceptor } from './core/session-expired.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    // apiOriginInterceptor va al final: el CSRF mira la URL original
    provideHttpClient(
      withFetch(),
      withInterceptors([csrfInterceptor, sessionExpiredInterceptor, apiOriginInterceptor]),
    ),
    provideRouter(routes),
  ],
};
