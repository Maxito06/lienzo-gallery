import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  let service: PublicCatalogService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicCatalogService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends only the defined query parameters', () => {
    service.listArtworks({ page: 2, pageSize: 12, technique: 'oleo', series: undefined }).subscribe();
    const req = httpTesting.expectOne((r) => r.url === '/api/public/artworks');
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize', 'technique']);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('technique')).toBe('oleo');
    req.flush({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 0 });
  });

  it('requests the public endpoints', () => {
    service.listArtworks({}).subscribe();
    httpTesting.expectOne('/api/public/artworks').flush({});
    service.getTechniques().subscribe();
    httpTesting.expectOne('/api/public/techniques').flush([]);
    service.getSeries().subscribe();
    httpTesting.expectOne('/api/public/series').flush([]);
  });

  it('requests the artwork by slug', () => {
    service.getArtwork('noche-estrellada').subscribe();
    httpTesting.expectOne('/api/public/artworks/noche-estrellada').flush({});
  });
});
