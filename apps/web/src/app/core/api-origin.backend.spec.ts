import { TestBed } from '@angular/core/testing';
import { FetchBackend, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { ApiOriginBackend } from './api-origin.backend';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;

describe('ApiOriginBackend', () => {
  const originalOrigin = env['API_ORIGIN'];
  let handle: ReturnType<typeof vi.spyOn>;
  let backend: ApiOriginBackend;

  beforeEach(() => {
    delete env['API_ORIGIN'];
    // Se espía el handle real de FetchBackend para no hacer peticiones
    handle = vi
      .spyOn(FetchBackend.prototype, 'handle')
      .mockReturnValue(of(new HttpResponse({ status: 200 })));
    TestBed.configureTestingModule({ providers: [ApiOriginBackend] });
    backend = TestBed.inject(ApiOriginBackend);
  });

  afterEach(() => {
    handle.mockRestore();
    if (originalOrigin === undefined) {
      delete env['API_ORIGIN'];
    } else {
      env['API_ORIGIN'] = originalOrigin;
    }
  });

  const sentUrl = () => (handle.mock.calls[0][0] as HttpRequest<unknown>).url;

  it('is an instance of FetchBackend', () => {
    expect(backend).toBeInstanceOf(FetchBackend);
  });

  it('rewrites /api/ URLs to the API origin', () => {
    backend.handle(new HttpRequest('GET', '/api/public/artworks')).subscribe();
    expect(sentUrl()).toBe('http://localhost:3000/public/artworks');
  });

  it('uses the API_ORIGIN environment variable when set', () => {
    env['API_ORIGIN'] = 'https://api.example.com';
    backend.handle(new HttpRequest('GET', '/api/public/series')).subscribe();
    expect(sentUrl()).toBe('https://api.example.com/public/series');
  });

  it('delegates non-/api/ URLs untouched', () => {
    const req = new HttpRequest('GET', 'https://res.cloudinary.com/x.jpg');
    backend.handle(req).subscribe();
    expect(handle.mock.calls[0][0]).toBe(req);
  });

  it('removes trailing slashes from the origin', () => {
    env['API_ORIGIN'] = 'https://api.example.com//';
    backend.handle(new HttpRequest('GET', '/api/public/series')).subscribe();
    expect(sentUrl()).toBe('https://api.example.com/public/series');
  });
});
