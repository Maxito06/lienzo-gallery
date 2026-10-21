import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BRAND } from '../../core/brand.config';
import { WHATSAPP_NUMBER } from '../../core/contact.config';
import { PublicLayout } from './public-layout';

@Component({ template: '<p id="child">Child page</p>' })
class ChildPage {}

describe('PublicLayout', () => {
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: PublicLayout, children: [{ path: '', component: ChildPage }] }]),
      ],
    });
    const harness = await RouterTestingHarness.create('/');
    root = harness.routeNativeElement as HTMLElement;
  });

  it('renders the navigation and the footer', () => {
    expect(root.querySelector('.skip-link')?.getAttribute('href')).toBe('#contenido');
    expect(root.querySelector('header a.brand')?.textContent).toBe(BRAND.name);
    expect(root.querySelector('nav[aria-label="Principal"] a[href="/"]')?.textContent).toBe('Galería');
    const footer = root.querySelector('footer')!;
    expect(footer.textContent).toContain(`${BRAND.name} · ${BRAND.footerNote}`);
    expect(footer.textContent).toContain(BRAND.credits);
    const github = footer.querySelector('a')!;
    expect(github.getAttribute('href')).toBe(BRAND.githubUrl);
    expect(github.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders the page inside the main region', () => {
    const main = root.querySelector('main#contenido');
    expect(main?.getAttribute('tabindex')).toBe('-1');
    expect(main?.querySelector('#child')).not.toBeNull();
  });

  it('hides the contact link when there is no WhatsApp number', () => {
    const contact = Array.from(root.querySelectorAll('nav a')).find(
      (a) => a.textContent?.trim() === 'Contacto',
    );
    if (WHATSAPP_NUMBER) {
      expect(contact?.getAttribute('href')?.startsWith('https://wa.me/')).toBe(true);
    } else {
      expect(contact).toBeUndefined();
    }
  });
});
