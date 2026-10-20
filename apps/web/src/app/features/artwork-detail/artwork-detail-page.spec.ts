import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ArtworkDetailPage, truncateDescription } from './artwork-detail-page';

const technique = { slug: 'oleo', nameEs: 'Óleo', nameEn: 'Oil' };

function detail(overrides: object = {}) {
  return {
    slug: 'sunset',
    title: 'Sunset',
    status: 'AVAILABLE',
    year: 2020,
    isDemo: true,
    widthCm: 50.5,
    heightCm: 40,
    referencePriceCop: 500000,
    descriptionEs: 'Una puesta de sol.',
    descriptionEn: null,
    publishedAt: '2026-01-01T00:00:00.000Z',
    technique,
    series: { slug: 'cielos', nameEs: 'Cielos', nameEn: null },
    images: [
      { cloudinaryPublicId: 'img-a', position: 0, isPrimary: false },
      { cloudinaryPublicId: 'img-b', position: 1, isPrimary: true },
      { cloudinaryPublicId: 'img-c', position: 2, isPrimary: false },
    ],
    ...overrides,
  };
}

describe('ArtworkDetailPage', () => {
  let fixture: ComponentFixture<ArtworkDetailPage>;
  let httpTesting: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let root: HTMLElement;

  const url = '/api/public/artworks/sunset';

  const start = () => {
    fixture = TestBed.createComponent(ArtworkDetailPage);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  };

  const load = (body: object) => {
    start();
    httpTesting.expectOne(url).flush(body);
    fixture.detectChanges();
  };

  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

  const mainImage = () => root.querySelector('img.main-image') as HTMLImageElement;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ slug: 'sunset' }));
    TestBed.configureTestingModule({
      imports: [ArtworkDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders the artwork details', () => {
    load(detail());
    const text = root.textContent ?? '';
    expect(root.querySelector('h1')?.textContent).toBe('Sunset');
    expect(text).toContain('Óleo');
    expect(text).toContain('2020');
    expect(text).toContain('50,5 × 40 cm');
    expect(text).toContain('Disponible');
    expect(text).toMatch(/Precio de referencia: \$\s500\.000/);
    expect(text).toContain('Una puesta de sol.');
    expect(text).toContain(
      'Obra de demostración: proyecto de portafolio con obras de dominio público.',
    );
    expect(root.querySelector('a[href="/?series=cielos"]')?.textContent).toContain('Cielos');
  });

  it('shows the not found message on 404 and sets noindex', () => {
    start();
    httpTesting.expectOne(url).flush('nope', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(root.textContent).toContain('Obra no encontrada.');
    expect(root.querySelector('a[href="/"]')?.textContent).toContain('Volver a la galería');
    expect(TestBed.inject(Title).getTitle()).toBe('Obra no encontrada · Lienzo');
    expect(TestBed.inject(Meta).getTag("name='robots'")?.content).toBe('noindex');
  });

  it('shows the error message and retries', () => {
    start();
    httpTesting.expectOne(url).flush('fail', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar la obra. Inténtalo de nuevo.',
    );
    button('Reintentar').click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Cargando obra…');
    httpTesting.expectOne(url).flush(detail());
    fixture.detectChanges();
    expect(root.querySelector('h1')?.textContent).toBe('Sunset');
  });

  it('starts the carousel on the primary image', () => {
    load(detail());
    expect(mainImage().src).toContain('img-b');
    expect(mainImage().getAttribute('alt')).toBe('Sunset — imagen 2 de 3');
    expect(mainImage().hasAttribute('loading')).toBe(false);
    expect(root.textContent).toContain('Imagen 2 de 3');
  });

  it('moves to the next image and wraps around', () => {
    load(detail());
    button('Siguiente').click();
    fixture.detectChanges();
    expect(mainImage().src).toContain('img-c');
    button('Siguiente').click();
    fixture.detectChanges();
    expect(mainImage().src).toContain('img-a');
    button('Anterior').click();
    fixture.detectChanges();
    expect(mainImage().src).toContain('img-c');
  });

  it('shows the thumbnails only when there are several images', () => {
    load(detail());
    expect(root.querySelectorAll('.thumbnails button').length).toBe(3);
    expect(
      root.querySelector('.thumbnails [aria-current="true"]')?.getAttribute('aria-label'),
    ).toBe('Ver imagen 2');

    params.next(convertToParamMap({ slug: 'solo' }));
    const single = [{ cloudinaryPublicId: 'only', position: 0, isPrimary: true }];
    httpTesting
      .expectOne('/api/public/artworks/solo')
      .flush(detail({ slug: 'solo', images: single }));
    fixture.detectChanges();
    expect(root.querySelector('.thumbnails')).toBeNull();
    expect(root.textContent).not.toContain('Siguiente');
  });

  it('shows the sold notice instead of the WhatsApp link when sold', () => {
    load(detail({ status: 'SOLD' }));
    expect(root.textContent).toContain('Esta obra ya fue vendida.');
    expect(root.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });

  it('sets the title and the Open Graph description', () => {
    load(detail());
    const meta = TestBed.inject(Meta);
    expect(TestBed.inject(Title).getTitle()).toBe('Sunset · Lienzo');
    expect(meta.getTag("name='description'")?.content).toBe('Una puesta de sol.');
    expect(meta.getTag("property='og:description'")?.content).toBe('Una puesta de sol.');
    expect(meta.getTag("property='og:type'")?.content).toBe('article');
    expect(meta.getTag("property='og:image'")?.content).toContain('img-b');
    expect(meta.getTag("name='twitter:card'")?.content).toBe('summary_large_image');
    expect(meta.getTag("name='robots'")).toBeNull();
  });
});

describe('truncateDescription', () => {
  it('truncateDescription cuts at a word boundary and keeps short text intact', () => {
    expect(truncateDescription('Texto corto.')).toBe('Texto corto.');
    const result = truncateDescription('palabra '.repeat(40));
    expect(result.length).toBeLessThanOrEqual(155);
    expect(result.endsWith('…')).toBe(true);
    expect(result.slice(0, -1).split(' ').every((w) => w === 'palabra')).toBe(true);
  });
});
