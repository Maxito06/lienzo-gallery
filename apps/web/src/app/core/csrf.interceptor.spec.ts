import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('adds the CSRF header to POST, PUT, PATCH and DELETE requests to /api/', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      http.request(method, '/api/artworks').subscribe();
      const req = httpTesting.expectOne('/api/artworks');
      expect(req.request.method).toBe(method);
      expect(req.request.headers.get('X-Requested-With')).toBe('lienzo-web');
      req.flush({});
    }
  });

  it('does not add the header to GET requests', () => {
    http.get('/api/artworks').subscribe();
    const req = httpTesting.expectOne('/api/artworks');
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush([]);
  });

  it('does not add the header to requests outside /api/ such as Cloudinary uploads', () => {
    const url = 'https://api.cloudinary.com/v1_1/test/image/upload';
    http.post(url, {}).subscribe();
    const req = httpTesting.expectOne(url);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush({});
  });
});
