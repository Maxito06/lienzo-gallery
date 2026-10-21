import { BRAND } from '../../core/brand.config';
import { TestBed } from '@angular/core/testing';
import { RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  it('sets the 404 status when running on the server', () => {
    const responseInit: ResponseInit = { status: 200 };
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [provideRouter([]), { provide: RESPONSE_INIT, useValue: responseInit }],
    });
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    expect(responseInit.status).toBe(404);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Página no encontrada.');
  });

  it('sets the noindex title', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    expect(TestBed.inject(Title).getTitle()).toBe(`Página no encontrada · ${BRAND.name}`);
    expect(TestBed.inject(Meta).getTag("name='robots'")?.content).toBe('noindex');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href'),
    ).toBe('/');
  });
});
