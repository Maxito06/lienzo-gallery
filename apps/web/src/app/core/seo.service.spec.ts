import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService, truncateDescription } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  let meta: Meta;

  const content = (selector: string) => meta.getTag(selector)?.content;

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
    meta = TestBed.inject(Meta);
  });

  afterEach(() => {
    for (const selector of [
      "name='description'",
      "property='og:title'",
      "property='og:description'",
      "property='og:type'",
      "property='og:image'",
      "name='twitter:card'",
      "name='robots'",
    ]) {
      meta.removeTag(selector);
    }
  });

  it('sets title, description and Open Graph tags', () => {
    seo.setPage({
      title: 'Obra · Lienzo',
      description: 'Texto',
      image: 'https://x/y.jpg',
      type: 'article',
    });
    expect(TestBed.inject(Title).getTitle()).toBe('Obra · Lienzo');
    expect(content("name='description'")).toBe('Texto');
    expect(content("property='og:title'")).toBe('Obra · Lienzo');
    expect(content("property='og:description'")).toBe('Texto');
    expect(content("property='og:type'")).toBe('article');
    expect(content("property='og:image'")).toBe('https://x/y.jpg');
    expect(content("name='twitter:card'")).toBe('summary_large_image');
  });

  it('removes the image tags when there is no image', () => {
    seo.setPage({ title: 'A', image: 'https://x/y.jpg', description: 'd' });
    seo.setPage({ title: 'B' });
    expect(meta.getTag("property='og:image'")).toBeNull();
    expect(meta.getTag("name='description'")).toBeNull();
    expect(meta.getTag("property='og:description'")).toBeNull();
    expect(content("property='og:type'")).toBe('website');
  });

  it('adds noindex when requested', () => {
    seo.setPage({ title: 'Admin', noindex: true });
    expect(content("name='robots'")).toBe('noindex');
  });

  it('removes noindex on the next indexable page', () => {
    seo.setPage({ title: 'Admin', noindex: true });
    seo.setPage({ title: 'Galería' });
    expect(meta.getTag("name='robots'")).toBeNull();
  });

  it('uses summary card without image', () => {
    seo.setPage({ title: 'Sin imagen' });
    expect(content("name='twitter:card'")).toBe('summary');
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
