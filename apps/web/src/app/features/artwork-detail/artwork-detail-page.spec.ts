import { DOCUMENT } from '@angular/common';
import { WHATSAPP_NUMBER } from '../../core/contact.config';
import { BRAND } from '../../core/brand.config';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ArtworkDetailPage } from './artwork-detail-page';

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
    expect(text).toMatch(/Precio de referencia\s*\$\s500\.000/);
    expect(text).toContain('Una puesta de sol.');
    expect(text).toContain(
      'Obra de dominio público, parte de la galería de demostración.',
    );
    expect(root.querySelector('a[href="/?series=cielos"]')?.textContent).toContain('Cielos');
  });

  it('shows the not found message on 404 and sets noindex', () => {
    start();
    httpTesting.expectOne(url).flush('nope', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(root.textContent).toContain('Obra no encontrada.');
    expect(root.querySelector('a[href="/"]')?.textContent).toContain('Volver a la galería');
    expect(TestBed.inject(Title).getTitle()).toBe(`Obra no encontrada · ${BRAND.name}`);
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

  it('passes the primary image first to the viewer', () => {
    load(detail());
    const room = root.querySelector('app-artwork-viewer img.room');
    expect(room).not.toBeNull();
    expect(root.querySelector('app-artwork-viewer img.artwork')?.getAttribute('src')).toContain('img-b');
    expect(root.querySelectorAll('.thumbnails button').length).toBe(3);
  });

  it('shows measurements, series and price only when present', () => {
    load(detail());
    const text = root.textContent ?? '';
    expect(text).toContain('Medidas');
    expect(text).toContain('Serie');
    expect(text).toContain('Precio de referencia');

    params.next(convertToParamMap({ slug: 'bare' }));
    httpTesting
      .expectOne('/api/public/artworks/bare')
      .flush(
        detail({
          slug: 'bare',
          widthCm: null,
          heightCm: null,
          series: null,
          referencePriceCop: null,
          descriptionEs: null,
          isDemo: false,
        }),
      );
    fixture.detectChanges();
    expect(root.querySelector('dl')).toBeNull();
    expect(root.querySelector('.description')).toBeNull();
    expect(root.querySelector('.demo')).toBeNull();
  });

  it('shows the sold notice instead of the WhatsApp link when sold', () => {
    load(detail({ status: 'SOLD' }));
    expect(root.textContent).toContain('Esta obra ya fue vendida.');
    expect(root.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });

  it('sets the title and the Open Graph description', () => {
    load(detail());
    const meta = TestBed.inject(Meta);
    expect(TestBed.inject(Title).getTitle()).toBe(`Sunset · ${BRAND.name}`);
    expect(meta.getTag("name='description'")?.content).toBe('Una puesta de sol.');
    expect(meta.getTag("property='og:description'")?.content).toBe('Una puesta de sol.');
    expect(meta.getTag("property='og:type'")?.content).toBe('article');
    expect(meta.getTag("property='og:image'")?.content).toContain('img-b');
    expect(meta.getTag("name='twitter:card'")?.content).toBe('summary_large_image');
    expect(meta.getTag("name='robots'")).toBeNull();
  });

  it('sets the canonical URL and the VisualArtwork JSON-LD without price', () => {
    load(detail());
    const head = TestBed.inject(DOCUMENT).head;
    expect(head.querySelector("link[rel='canonical']")?.getAttribute('href')).toBe(
      `${BRAND.siteUrl}/obras/sunset`,
    );
    expect(TestBed.inject(Meta).getTag("property='og:url'")?.content).toBe(
      `${BRAND.siteUrl}/obras/sunset`,
    );
    const scripts = head.querySelectorAll("script[type='application/ld+json']");
    expect(scripts.length).toBe(1);
    const data = JSON.parse(scripts[0].textContent!);
    expect(data['@type']).toBe('VisualArtwork');
    expect(data.name).toBe('Sunset');
    expect(data.artform).toBe('Óleo');
    expect(data.dateCreated).toBe('2020');
    expect(data.image).toContain('w_1200/img-b');
    expect(data.width.value).toBe(50.5);
    expect(scripts[0].textContent).not.toMatch(/price|offers/i);
  });

  it('has no canonical or JSON-LD when the artwork is not found', () => {
    start();
    httpTesting.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
    const head = TestBed.inject(DOCUMENT).head;
    expect(head.querySelector("link[rel='canonical']")).toBeNull();
    expect(head.querySelector("script[type='application/ld+json']")).toBeNull();
  });

  it('puts the title and the artwork URL in the WhatsApp message', () => {
    load(detail());
    const link = root.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]');
    if (WHATSAPP_NUMBER) {
      const text = decodeURIComponent(new URL(link!.href).searchParams.get('text')!);
      expect(text).toContain('Sunset');
      expect(text).toContain(`${BRAND.siteUrl}/obras/sunset`);
    } else {
      expect(link).toBeNull();
    }
  });
});
