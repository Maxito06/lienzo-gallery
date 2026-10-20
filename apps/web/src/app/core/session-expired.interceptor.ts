import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Si una petición del panel recibe 401, la sesión expiró: se vuelve al login.
// /api/auth/* no se toca porque el login necesita ver su propio 401.
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith('/api/admin/')
      ) {
        auth.clearSession();
        void router.navigate(['/admin/login']);
      }
      return throwError(() => error);
    }),
  );
};
