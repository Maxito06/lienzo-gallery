import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

describe('sessionExpiredInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).user.set({ id: 'a1', email: 'admin@example.com' });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('redirects to the login on 401 from /api/admin/ requests', () => {
    let failed = false;
    http.get('/api/admin/techniques').subscribe({ error: () => (failed = true) });

    httpTesting
      .expectOne('/api/admin/techniques')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/admin/login']);
    expect(TestBed.inject(AuthService).user()).toBeNull();
  });

  it('does not redirect on 401 from /api/auth/ requests', () => {
    let failed = false;
    http.post('/api/auth/login', {}).subscribe({ error: () => (failed = true) });

    httpTesting
      .expectOne('/api/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(AuthService).user()).not.toBeNull();
  });

  it('does not redirect on non-401 errors', () => {
    let failed = false;
    http.get('/api/admin/techniques').subscribe({ error: () => (failed = true) });

    httpTesting
      .expectOne('/api/admin/techniques')
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(failed).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
