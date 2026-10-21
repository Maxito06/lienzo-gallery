import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicArtworkSummary } from '../../core/public-catalog.service';
import { ArtworkCard } from './artwork-card';

const base: PublicArtworkSummary = {
  slug: 'sunset',
  title: 'Sunset',
  status: 'AVAILABLE',
  year: 2020,
  isDemo: false,
  technique: { slug: 'oleo', nameEs: 'Óleo', nameEn: 'Oil' },
  series: null,
  primaryImagePublicId: 'abc',
};

function render(artwork: PublicArtworkSummary, inputs: { eager?: boolean; highPriority?: boolean } = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ArtworkCard);
  fixture.componentRef.setInput('artwork', artwork);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ArtworkCard', () => {
  it('shows the title, technique and year, and the status', () => {
    const root = render(base);
    expect(root.querySelector('h2')?.textContent).toBe('Sunset');
    expect(root.querySelector('.details')?.textContent).toBe('Óleo · 2020');
    expect(root.querySelector('.status')?.textContent).toBe('Disponible');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/obras/sunset');
  });

  it('omits the year when there is none', () => {
    const root = render({ ...base, year: null });
    expect(root.querySelector('.details')?.textContent).toBe('Óleo');
  });

  it('shows the status text for reserved and sold artworks', () => {
    expect(render({ ...base, status: 'RESERVED' }).querySelector('.status')?.textContent).toBe(
      'Reservada',
    );
  });

  it('shows a placeholder when the artwork has no image', () => {
    const root = render({ ...base, primaryImagePublicId: null });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Sin imagen');
  });

  it('sets the loading hints from its inputs', () => {
    const root = render(base, { eager: true, highPriority: true });
    const img = root.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });
});
