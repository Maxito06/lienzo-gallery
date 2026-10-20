import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ArtworksPage } from './artworks-page';

const technique = { id: 't1', slug: 'oleo', nameEs: 'Óleo', nameEn: null };

function artwork(overrides: object = {}) {
  return {
    id: 'a1',
    slug: 'sunset',
    title: 'Sunset',
    status: 'AVAILABLE',
    isPublished: false,
    publishedAt: null,
    isDemo: false,
    year: 2020,
    widthCm: 50,
    heightCm: 40.5,
    referencePriceCop: null,
    technique,
    series: null,
    imageCount: 1,
    primaryImagePublicId: 'abc',
    ...overrides,
  };
}

describe('ArtworksPage', () => {
  let fixture: ComponentFixture<ArtworksPage>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

  const loadWith = (items: unknown[]) => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/artworks').flush(items);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ArtworksPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ArtworksPage);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the artworks on load', () => {
    fixture.detectChanges();
    expect(root.textContent).toContain('Cargando…');
    httpTesting.expectOne('/api/admin/artworks').flush([artwork({ series: { ...technique, nameEs: 'Paisajes' } })]);
    fixture.detectChanges();

    const cells = Array.from(root.querySelectorAll('tbody td')).map((td) => td.textContent?.trim());
    // La primera columna es la miniatura (vacía mientras no se configure la nube)
    expect(cells[1]).toBe('Sunset');
    expect(cells[2]).toBe('Óleo');
    expect(cells[3]).toBe('Paisajes');
    expect(cells[4]).toBe('Disponible');
    expect(cells[5]).toBe('Borrador');
    expect(root.textContent).not.toContain('Demo');
  });

  it('shows the demo label for demo artworks', () => {
    loadWith([artwork({ isDemo: true })]);
    expect(root.querySelector('tbody td:nth-child(2) strong')?.textContent).toBe('Demo');
  });

  it('shows the empty message when there are no artworks', () => {
    loadWith([]);
    expect(root.textContent).toContain('Todavía no hay obras.');
  });

  it('publishes a draft and reloads the list', () => {
    loadWith([artwork()]);
    button('Publicar').click();

    const publish = httpTesting.expectOne('/api/admin/artworks/a1/publish');
    expect(publish.request.method).toBe('POST');
    publish.flush(artwork({ isPublished: true, publishedAt: '2026-01-02T00:00:00.000Z' }));

    httpTesting
      .expectOne('/api/admin/artworks')
      .flush([artwork({ isPublished: true, publishedAt: '2026-01-02T00:00:00.000Z' })]);
    fixture.detectChanges();

    expect(root.textContent).toContain('Publicada');
    expect(button('Despublicar')).toBeDefined();
  });

  it('shows the missing image message on 409 when publishing', () => {
    loadWith([artwork()]);
    button('Publicar').click();

    httpTesting
      .expectOne('/api/admin/artworks/a1/publish')
      .flush({ message: 'needs image' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Para publicar, la obra necesita al menos una imagen principal.',
    );
  });

  it('asks for confirmation before deleting', () => {
    loadWith([artwork()]);
    button('Eliminar').click();
    fixture.detectChanges();

    expect(root.textContent).toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/artworks/a1');

    button('Sí').click();
    const del = httpTesting.expectOne('/api/admin/artworks/a1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne('/api/admin/artworks').flush([]);
  });

  it('unpublishes a published artwork', () => {
    loadWith([artwork({ isPublished: true, publishedAt: '2026-01-02T00:00:00.000Z' })]);
    button('Despublicar').click();

    const req = httpTesting.expectOne('/api/admin/artworks/a1/unpublish');
    expect(req.request.method).toBe('POST');
    req.flush(artwork());
    httpTesting.expectOne('/api/admin/artworks').flush([artwork()]);
    fixture.detectChanges();

    expect(root.textContent).toContain('Borrador');
  });
});
