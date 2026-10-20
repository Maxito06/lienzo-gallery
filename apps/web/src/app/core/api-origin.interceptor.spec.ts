import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiOriginInterceptor } from './api-origin.interceptor';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process
  .env;

describe('apiOriginInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const originalOrigin = env['API_ORIGIN'];

  const setup = (platform: 'server' | 'browser') => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        provideHttpClient(withInterceptors([apiOriginInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    delete env['API_ORIGIN'];
  });

  afterEach(() => {
    httpTesting.verify();
    if (originalOrigin === undefined) {
      delete env['API_ORIGIN'];
    } else {
      env['API_ORIGIN'] = originalOrigin;
    }
  });

  it('rewrites /api/ URLs to the API origin on the server', () => {
    setup('server');
    http.get('/api/public/artworks').subscribe();
    httpTesting.expectOne('http://localhost:3000/public/artworks').flush({});
  });

  it('uses the API_ORIGIN environment variable when set', () => {
    env['API_ORIGIN'] = 'https://api.example.com/';
    setup('server');
    http.get('/api/public/series').subscribe();
    httpTesting.expectOne('https://api.example.com/public/series').flush([]);
  });

  it('leaves URLs untouched in the browser', () => {
    setup('browser');
    http.get('/api/public/artworks').subscribe();
    httpTesting.expectOne('/api/public/artworks').flush({});
  });

  it('leaves non-/api/ URLs untouched on the server', () => {
    setup('server');
    http.get('https://res.cloudinary.com/x.jpg').subscribe();
    httpTesting.expectOne('https://res.cloudinary.com/x.jpg').flush({});
  });
});
