import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GalleryPage } from './gallery-page';

const technique = { slug: 'oleo', nameEs: 'Óleo', nameEn: 'Oil' };

function artwork(overrides: object = {}) {
  return {
    slug: 'sunset',
    title: 'Sunset',
    status: 'AVAILABLE',
    year: 2020,
    isDemo: false,
    technique,
    series: null,
    primaryImagePublicId: 'abc',
    ...overrides,
  };
}

function pageOf(items: unknown[], page = 1, totalPages = 1) {
  return { items, page, pageSize: 12, total: items.length, totalPages };
}

describe('GalleryPage', () => {
  let fixture: ComponentFixture<GalleryPage>;
  let httpTesting: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let root: HTMLElement;

  const artworksUrl = (r: { url: string }) => r.url === '/api/public/artworks';

  // Crea el componente con una URL dada y responde a los filtros
  const start = (query: Record<string, string> = {}) => {
    params.next(convertToParamMap(query));
    fixture = TestBed.createComponent(GalleryPage);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne('/api/public/techniques').flush([{ ...technique, artworkCount: 1 }]);
    httpTesting.expectOne('/api/public/series').flush([]);
  };

  const respond = (body: object) => {
    httpTesting.expectOne(artworksUrl).flush(body);
    fixture.detectChanges();
  };

  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [GalleryPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate as never);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders the artwork cards', () => {
    start();
    respond(pageOf([artwork(), artwork({ slug: 'moon', title: 'Moon', primaryImagePublicId: null, isDemo: true })]));
    const cards = root.querySelectorAll('ul.grid > li');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('img')?.getAttribute('alt')).toBe('Sunset');
    expect(cards[0].textContent).toContain('Óleo');
    expect(cards[0].textContent).toContain('Disponible');
    expect(cards[0].textContent).not.toContain('Obra de demostración');
    expect(cards[1].textContent).toContain('Sin imagen');
    expect(cards[1].textContent).toContain('Obra de demostración');
    expect(cards[0].querySelector('a')?.getAttribute('href')).toBe('/obras/sunset');
  });

  it('requests the API with the filters from the URL', () => {
    start({ series: 'flores', technique: 'oleo', status: 'SOLD', page: '3' });
    const req = httpTesting.expectOne(artworksUrl);
    expect(req.request.params.get('series')).toBe('flores');
    expect(req.request.params.get('technique')).toBe('oleo');
    expect(req.request.params.get('status')).toBe('SOLD');
    expect(req.request.params.get('page')).toBe('3');
    req.flush(pageOf([artwork()], 3, 3));
  });

  it('ignores invalid status and page values', () => {
    start({ status: 'HIDDEN', page: '0' });
    let req = httpTesting.expectOne(artworksUrl);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([]));

    params.next(convertToParamMap({ page: 'abc' }));
    req = httpTesting.expectOne(artworksUrl);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([]));
  });

  it('shows the empty message when there are no artworks', () => {
    start();
    respond(pageOf([], 1, 0));
    expect(root.textContent).toContain('No hay obras que coincidan con los filtros.');
    expect(root.querySelector('ul.grid')).toBeNull();
  });

  it('shows the error message and retries', () => {
    start();
    httpTesting.expectOne(artworksUrl).flush('fail', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar la galería. Inténtalo de nuevo.',
    );

    button('Reintentar').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Cargando obras…');
    respond(pageOf([artwork()]));
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelectorAll('ul.grid > li').length).toBe(1);
  });

  it('navigates with the selected filter and resets the page', () => {
    start({ page: '2' });
    respond(pageOf([artwork()], 2, 3));
    const select = root.querySelectorAll('select')[0] as HTMLSelectElement;
    select.value = 'oleo';
    select.dispatchEvent(new Event('change'));
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { technique: 'oleo', page: null },
      queryParamsHandling: 'merge',
    });
  });

  it('disables previous on the first page and next on the last', () => {
    start();
    respond(pageOf([artwork()], 1, 2));
    expect(button('Anterior').disabled).toBe(true);
    expect(button('Siguiente').disabled).toBe(false);
    expect(root.textContent).toContain('Página 1 de 2');

    params.next(convertToParamMap({ page: '2' }));
    respond(pageOf([artwork()], 2, 2));
    expect(button('Anterior').disabled).toBe(false);
    expect(button('Siguiente').disabled).toBe(true);
  });
});
