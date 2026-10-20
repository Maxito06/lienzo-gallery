import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ArtworkFormPage } from './artwork-form-page';

const TECHNIQUE = { id: 't1', slug: 'oleo', nameEs: 'Óleo', nameEn: null, artworkCount: 0 };
const SERIES = { id: 's1', slug: 'paisajes', nameEs: 'Paisajes', nameEn: null, artworkCount: 0 };

const DETAIL = {
  id: 'a1',
  slug: 'sunset',
  title: 'Sunset',
  status: 'RESERVED',
  isPublished: true,
  publishedAt: '2026-01-02T00:00:00.000Z',
  year: 2020,
  widthCm: 50,
  heightCm: 40.5,
  referencePriceCop: 1500000,
  technique: { id: 't1', slug: 'oleo', nameEs: 'Óleo', nameEn: null },
  series: { id: 's1', slug: 'paisajes', nameEs: 'Paisajes', nameEn: null },
  imageCount: 1,
  primaryImagePublicId: 'abc',
  descriptionEs: 'Una puesta de sol',
  descriptionEn: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  images: [],
};

describe('ArtworkFormPage', () => {
  let fixture: ComponentFixture<ArtworkFormPage>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  const setup = (id: string | null) => {
    TestBed.configureTestingModule({
      imports: [ArtworkFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ArtworkFormPage);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  };

  const flushLookups = (techniques: unknown[] = [TECHNIQUE]) => {
    httpTesting.expectOne('/api/admin/techniques').flush(techniques);
    httpTesting.expectOne('/api/admin/series').flush([SERIES]);
  };

  const type = (selector: string, value: string) => {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    el.value = value;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
  };

  const submit = () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  afterEach(() => {
    httpTesting.verify();
  });

  it('does not call the API when the form is invalid', () => {
    setup(null);
    flushLookups();
    fixture.detectChanges();

    submit();

    expect(root.querySelectorAll('.field-error').length).toBeGreaterThan(0);
    httpTesting.expectNone('/api/admin/artworks');
  });

  it('creates an artwork and navigates to the list', () => {
    setup(null);
    flushLookups();
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type('#title', '  Sunset  ');
    type('#techniqueId', 't1');
    type('#year', '2020');
    type('#widthCm', '50.5');
    submit();

    const req = httpTesting.expectOne('/api/admin/artworks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Sunset',
      techniqueId: 't1',
      seriesId: null,
      year: 2020,
      widthCm: 50.5,
      heightCm: null,
      status: 'AVAILABLE',
      referencePriceCop: null,
      descriptionEs: null,
      descriptionEn: null,
    });
    req.flush(DETAIL);

    expect(navigate).toHaveBeenCalledWith(['/admin/artworks']);
  });

  it('never sends publishedAt or isDemo', () => {
    setup('a1');
    flushLookups();
    httpTesting.expectOne('/api/admin/artworks/a1').flush(DETAIL);
    fixture.detectChanges();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    submit();

    const req = httpTesting.expectOne('/api/admin/artworks/a1');
    expect(req.request.method).toBe('PATCH');
    expect(Object.keys(req.request.body as object)).not.toContain('publishedAt');
    expect(Object.keys(req.request.body as object)).not.toContain('isDemo');
    req.flush(DETAIL);
  });

  it('loads the artwork and fills the form in edit mode', () => {
    setup('a1');
    flushLookups();
    httpTesting.expectOne('/api/admin/artworks/a1').flush(DETAIL);
    fixture.detectChanges();

    expect(root.querySelector<HTMLInputElement>('#title')!.value).toBe('Sunset');
    expect(root.querySelector<HTMLInputElement>('#heightCm')!.value).toBe('40.5');
    expect(root.querySelector<HTMLSelectElement>('#status')!.value).toBe('RESERVED');
    expect(root.querySelector<HTMLSelectElement>('#techniqueId')!.value).toBe('t1');
    expect(root.querySelector<HTMLSelectElement>('#seriesId')!.value).toBe('s1');
    expect(root.querySelector('dl')?.textContent).toContain('sunset');
    expect(root.querySelector('dl')?.textContent).toContain('Publicada');
  });

  it('shows a notice when there are no techniques', () => {
    setup(null);
    flushLookups([]);
    fixture.detectChanges();

    expect(root.textContent).toContain('Primero crea una técnica.');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });
});
