import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { BRAND } from '../../core/brand.config';
import { WHATSAPP_NUMBER } from '../../core/contact.config';
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
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === text)!;

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
    expect(cards[0].textContent).toContain('Óleo · 2020');
    expect(cards[0].textContent).toContain('Disponible');
    expect(cards[1].textContent).toContain('Sin imagen');
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
    expect(root.textContent).toContain('No hay obras con estos filtros. Prueba quitando alguno.');
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
    button('Técnica ▾').click();
    fixture.detectChanges();
    button('Óleo').click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { technique: 'oleo', page: null },
      queryParamsHandling: 'merge',
    });
    // El panel se cierra al elegir
    fixture.detectChanges();
    expect(root.querySelector('#filter-panel-technique')).toBeNull();
  });

  it('shows the active filter in the trigger and removes it when chosen again', () => {
    start({ technique: 'oleo' });
    respond(pageOf([artwork()]));
    const trigger = button('Técnica: Óleo ▾');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe('filter-panel-technique');
    root.querySelector<HTMLButtonElement>('#filter-panel-technique .option')!.click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { technique: null, page: null },
      queryParamsHandling: 'merge',
    });
  });

  it('closes the dropdown with Escape and returns the focus to its button', () => {
    start();
    respond(pageOf([artwork()]));
    document.body.appendChild(root);
    const trigger = button('Estado ▾');
    trigger.click();
    fixture.detectChanges();
    expect(root.querySelector('#filter-panel-status')).not.toBeNull();
    root
      .querySelector('#filter-panel-status')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('#filter-panel-status')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    root.remove();
  });

  it('closes the dropdown when clicking outside', () => {
    start();
    respond(pageOf([artwork()]));
    document.body.appendChild(root);
    button('Serie ▾').click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(root.querySelector('#filter-panel-series')).toBeNull();
    root.remove();
  });

  it('removes a single filter from its chip and clears all of them', () => {
    start({ technique: 'oleo', status: 'SOLD' });
    respond(pageOf([artwork()]));
    root.querySelector<HTMLButtonElement>('button[aria-label="Quitar filtro Óleo"]')!.click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { technique: null, page: null },
      queryParamsHandling: 'merge',
    });
    root.querySelector<HTMLButtonElement>('.bar .text-button')!.click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { series: null, technique: null, status: null, page: null },
      queryParamsHandling: 'merge',
    });
  });

  it('shows the artwork count with singular and plural', () => {
    start();
    respond(pageOf([artwork()]));
    expect(root.querySelector('.count')?.textContent).toBe('1 obra');
    params.next(convertToParamMap({ page: '2' }));
    respond(pageOf([artwork(), artwork({ slug: 'b' })], 2, 2));
    expect(root.querySelector('.count')?.textContent).toBe('2 obras');
  });

  it('opens the mobile filters dialog on click', () => {
    start();
    respond(pageOf([artwork()]));
    const dialog = root.querySelector('dialog')!;
    const showModal = vi.fn();
    dialog.showModal = showModal;
    expect(showModal).not.toHaveBeenCalled();
    button('Filtros').click();
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state with a clear button when filters are active', () => {
    start({ technique: 'oleo' });
    respond(pageOf([], 1, 0));
    const clear = root.querySelector<HTMLButtonElement>('.message .text-button')!;
    expect(clear.textContent?.trim()).toBe('Limpiar filtros');
    clear.click();
    expect(navigate).toHaveBeenCalled();
  });

  it('hides the pagination when there is a single page', () => {
    start();
    respond(pageOf([artwork()], 1, 1));
    expect(root.querySelector('nav.pagination')).toBeNull();
  });

  it('disables previous on the first page and next on the last', () => {
    start();
    respond(pageOf([artwork()], 1, 2));
    expect(button('Anterior').disabled).toBe(true);
    expect(button('Siguiente').disabled).toBe(false);
    expect(root.querySelector('nav.pagination [aria-current="page"]')?.textContent?.trim()).toBe('1');
    expect(root.querySelectorAll('nav.pagination button').length).toBe(4);

    params.next(convertToParamMap({ page: '2' }));
    respond(pageOf([artwork()], 2, 2));
    expect(button('Anterior').disabled).toBe(false);
    expect(button('Siguiente').disabled).toBe(true);
  });

  it('shows the commission call to action only when there is a WhatsApp number', () => {
    start();
    respond(pageOf([artwork()]));
    const link = root.querySelector('aside a');
    if (WHATSAPP_NUMBER) {
      expect(root.querySelector('aside h2')?.textContent).toContain(BRAND.commissionTitle);
      expect(link?.getAttribute('href')?.startsWith('https://wa.me/')).toBe(true);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    } else {
      expect(link).toBeNull();
    }
  });

  it('loads the first images eagerly and the rest lazily', () => {
    start();
    const items = Array.from({ length: 6 }, (_, i) => artwork({ slug: `a${i}`, title: `A${i}` }));
    respond(pageOf(items));
    const images = Array.from(root.querySelectorAll('ul.grid img'));
    expect(images.map((img) => img.getAttribute('loading'))).toEqual([
      'eager',
      'eager',
      'eager',
      'eager',
      'lazy',
      'lazy',
    ]);
    expect(images[0].getAttribute('fetchpriority')).toBe('high');
    expect(images[1].hasAttribute('fetchpriority')).toBe(false);
  });
});

describe('GalleryPage pagination', () => {
  it('navigates to a numbered page', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const params = new BehaviorSubject(convertToParamMap({}));
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
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GalleryPage);
    fixture.detectChanges();
    http.expectOne('/api/public/techniques').flush([]);
    http.expectOne('/api/public/series').flush([]);
    http.expectOne((r) => r.url === '/api/public/artworks').flush(pageOf([artwork()], 1, 3));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Página 3"]')!.click();
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { page: 3 },
      queryParamsHandling: 'merge',
    });
    http.verify();
  });
});
