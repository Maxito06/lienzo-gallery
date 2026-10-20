import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TechniquesPage } from './techniques-page';

const OIL = { id: 't1', slug: 'oleo', nameEs: 'Óleo', nameEn: 'Oil', artworkCount: 2 };

describe('TechniquesPage', () => {
  let fixture: ComponentFixture<TechniquesPage>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

  const loadWith = (items: unknown[]) => {
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/techniques').flush(items);
    fixture.detectChanges();
  };

  const createOil = () => {
    button('Nueva técnica').click();
    fixture.detectChanges();
    const input = root.querySelector<HTMLInputElement>('#nameEs')!;
    input.value = 'Grabado';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TechniquesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TechniquesPage);
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the items on load', () => {
    fixture.detectChanges();
    expect(root.textContent).toContain('Cargando…');
    httpTesting.expectOne('/api/admin/techniques').flush([OIL]);
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr').length).toBe(1);
    expect(root.textContent).toContain('Óleo');
    expect(root.textContent).toContain('Oil');
  });

  it('shows the empty message when there are no items', () => {
    loadWith([]);
    expect(root.textContent).toContain('Todavía no hay técnicas.');
  });

  it('creates an item and reloads the list', () => {
    loadWith([]);
    createOil();

    const create = httpTesting.expectOne('/api/admin/techniques');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ nameEs: 'Grabado', nameEn: null });
    create.flush({ ...OIL, nameEs: 'Grabado' });

    const reload = httpTesting.expectOne('/api/admin/techniques');
    expect(reload.request.method).toBe('GET');
    reload.flush([{ ...OIL, nameEs: 'Grabado' }]);
    fixture.detectChanges();

    expect(root.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('shows the duplicate message on 409 when creating', () => {
    loadWith([]);
    createOil();

    httpTesting
      .expectOne('/api/admin/techniques')
      .flush({ message: 'exists' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya existe una técnica con ese nombre.',
    );
  });

  it('shows the has-artworks message on 409 when deleting', () => {
    loadWith([OIL]);
    button('Eliminar').click();
    fixture.detectChanges();
    button('Sí').click();

    const del = httpTesting.expectOne('/api/admin/techniques/t1');
    expect(del.request.method).toBe('DELETE');
    del.flush({ message: 'Technique is in use' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No se puede eliminar: tiene obras asociadas.',
    );
  });

  it('asks for confirmation before deleting', () => {
    loadWith([OIL]);
    button('Eliminar').click();
    fixture.detectChanges();

    expect(root.textContent).toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/techniques/t1');

    button('No').click();
    fixture.detectChanges();
    expect(root.textContent).not.toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/techniques/t1');
  });
});
