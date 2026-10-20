import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user()) {
    return true;
  }
  const loginUrl = router.createUrlTree(['/admin/login']);
  return auth.checkSession().pipe(
    map((hasSession) => (hasSession ? true : loginUrl)),
    // Cualquier error distinto de 401 también lleva al login
    catchError(() => of(loginUrl)),
  );
};
