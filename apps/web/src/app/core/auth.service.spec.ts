import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { csrfInterceptor } from './csrf.interceptor';

describe('AuthService', () => {
  let auth: AuthService;
  let httpTesting: HttpTestingController;
  const admin = { id: 'a1', email: 'admin@example.com' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('stores the user after a successful login', () => {
    let result: unknown;
    auth.login('admin@example.com', 'secret-password').subscribe((u) => (result = u));

    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@example.com', password: 'secret-password' });
    req.flush({ admin });

    expect(result).toEqual(admin);
    expect(auth.user()).toEqual(admin);
  });

  it('checkSession returns true and stores the user on 200', () => {
    let result: boolean | undefined;
    auth.checkSession().subscribe((ok) => (result = ok));

    httpTesting.expectOne('/api/auth/me').flush({ admin });

    expect(result).toBe(true);
    expect(auth.user()).toEqual(admin);
    expect(auth.checked()).toBe(true);
  });

  it('checkSession returns false on 401', () => {
    auth.user.set(admin);
    let result: boolean | undefined;
    auth.checkSession().subscribe((ok) => (result = ok));

    httpTesting
      .expectOne('/api/auth/me')
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.checked()).toBe(true);
  });

  it('logout clears the user even when the request fails', () => {
    auth.user.set(admin);
    let failed = false;
    auth.logout().subscribe({ error: () => (failed = true) });

    httpTesting
      .expectOne('/api/auth/logout')
      .flush('error', { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
    expect(auth.user()).toBeNull();
  });
});
