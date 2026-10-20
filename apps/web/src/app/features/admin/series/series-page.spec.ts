import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SeriesPage } from './series-page';

const OIL = { id: 't1', slug: 'oleo', nameEs: 'Óleo', nameEn: 'Oil', artworkCount: 2 };

describe('SeriesPage', () => {
  let fixture: ComponentFixture<SeriesPage>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

  const loadWith = (items: unknown[]) => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/series').flush(items);
    fixture.detectChanges();
  };

  const createOil = () => {
    button('Nueva serie').click();
    fixture.detectChanges();
    const input = root.querySelector<HTMLInputElement>('#nameEs')!;
    input.value = 'Grabado';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeriesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SeriesPage);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the items on load', () => {
    fixture.detectChanges();
    expect(root.textContent).toContain('Cargando…');
    httpTesting.expectOne('/api/admin/series').flush([OIL]);
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr').length).toBe(1);
    expect(root.textContent).toContain('Óleo');
    expect(root.textContent).toContain('Oil');
  });

  it('shows the empty message when there are no items', () => {
    loadWith([]);
    expect(root.textContent).toContain('Todavía no hay series.');
  });

  it('creates an item and reloads the list', () => {
    loadWith([]);
    createOil();

    const create = httpTesting.expectOne('/api/admin/series');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ nameEs: 'Grabado', nameEn: null });
    create.flush({ ...OIL, nameEs: 'Grabado' });

    const reload = httpTesting.expectOne('/api/admin/series');
    expect(reload.request.method).toBe('GET');
    reload.flush([{ ...OIL, nameEs: 'Grabado' }]);
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('shows the duplicate message on 409 when creating', () => {
    loadWith([]);
    createOil();

    httpTesting
      .expectOne('/api/admin/series')
      .flush({ message: 'exists' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya existe una serie con ese nombre.',
    );
  });


  it('asks for confirmation before deleting', () => {
    loadWith([OIL]);
    button('Eliminar').click();
    fixture.detectChanges();

    expect(root.textContent).toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/series/t1');

    button('No').click();
    fixture.detectChanges();
    expect(root.textContent).not.toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/series/t1');
  });
});
