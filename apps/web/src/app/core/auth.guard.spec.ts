import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let httpTesting: HttpTestingController;

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('allows navigation when a session exists', async () => {
    const result = runGuard() as Observable<boolean | UrlTree>;
    const done = firstValueFrom(result);

    httpTesting
      .expectOne('/api/auth/me')
      .flush({ admin: { id: 'a1', email: 'admin@example.com' } });

    expect(await done).toBe(true);
    expect(TestBed.inject(AuthService).user()?.email).toBe('admin@example.com');
  });

  it('redirects to /admin/login when there is no session', async () => {
    const result = runGuard() as Observable<boolean | UrlTree>;
    const done = firstValueFrom(result);

    httpTesting
      .expectOne('/api/auth/me')
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const outcome = await done;
    expect(outcome).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(outcome as UrlTree)).toBe('/admin/login');
  });
});
