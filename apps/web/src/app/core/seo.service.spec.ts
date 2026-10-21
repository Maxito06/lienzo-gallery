import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { BRAND } from './brand.config';
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

describe('SeoService canonical and structured data', () => {
  let seo: SeoService;
  let meta: Meta;

  const head = () => TestBed.inject(DOCUMENT).head;
  const canonicals = () => head().querySelectorAll("link[rel='canonical']");
  const jsonLdScripts = () => head().querySelectorAll("script[type='application/ld+json']");
  const artwork = {
    title: 'Utopía',
    slug: 'utopia',
    image: 'https://res.cloudinary.com/x/image/upload/w_1200/utopia',
    technique: 'Óleo',
    year: 1999,
    widthCm: 50.5,
    heightCm: 40,
    description: 'Una obra.',
  };

  beforeEach(() => {
    seo = TestBed.inject(SeoService);
    meta = TestBed.inject(Meta);
  });

  afterEach(() => {
    // Un setPage sin path deja la cabecera sin canonical, og:url ni JSON-LD
    seo.setPage({ title: 'cleanup' });
    for (const selector of [
      "name='description'",
      "property='og:title'",
      "property='og:type'",
      "name='twitter:card'",
    ]) {
      meta.removeTag(selector);
    }
  });

  it('sets canonical and og:url on indexable pages', () => {
    seo.setPage({ title: 'Obra', path: '/obras/utopia' });
    expect(canonicals()[0].getAttribute('href')).toBe(`${BRAND.siteUrl}/obras/utopia`);
    expect(meta.getTag("property='og:url'")?.content).toBe(`${BRAND.siteUrl}/obras/utopia`);
  });

  it('does not duplicate canonical or og:url when called twice', () => {
    seo.setPage({ title: 'Galería', path: '/' });
    seo.setPage({ title: 'Obra', path: '/obras/utopia' });
    expect(canonicals().length).toBe(1);
    expect(canonicals()[0].getAttribute('href')).toBe(`${BRAND.siteUrl}/obras/utopia`);
    expect(meta.getTags("property='og:url'").length).toBe(1);
  });

  it('has no canonical or og:url on noindex pages', () => {
    seo.setPage({ title: 'Galería', path: '/' });
    seo.setPage({ title: 'Error', noindex: true, path: '/x' });
    expect(canonicals().length).toBe(0);
    expect(meta.getTag("property='og:url'")).toBeNull();
  });

  it('removes canonical and og:url when there is no path', () => {
    seo.setPage({ title: 'Galería', path: '/' });
    seo.setPage({ title: 'Otra' });
    expect(canonicals().length).toBe(0);
    expect(meta.getTag("property='og:url'")).toBeNull();
  });

  it('writes VisualArtwork JSON-LD with the expected fields and no price', () => {
    seo.setPage({ title: 'Obra', path: '/obras/utopia' });
    seo.setArtworkStructuredData(artwork);
    expect(jsonLdScripts().length).toBe(1);
    const data = JSON.parse(jsonLdScripts()[0].textContent!);
    expect(data['@type']).toBe('VisualArtwork');
    expect(data.name).toBe('Utopía');
    expect(data.image).toBe(artwork.image);
    expect(data.url).toBe(`${BRAND.siteUrl}/obras/utopia`);
    expect(data.artform).toBe('Óleo');
    expect(data.dateCreated).toBe('1999');
    expect(data.width).toEqual({
      '@type': 'QuantitativeValue',
      value: 50.5,
      unitCode: 'CMT',
      unitText: 'cm',
    });
    expect(data.height.value).toBe(40);
    expect(data.description).toBe('Una obra.');
    expect(jsonLdScripts()[0].textContent).not.toMatch(/price|offers/i);
  });

  it('omits size and description in JSON-LD when they are missing', () => {
    seo.setArtworkStructuredData({ ...artwork, widthCm: null, heightCm: null, description: null });
    const data = JSON.parse(jsonLdScripts()[0].textContent!);
    expect(data.width).toBeUndefined();
    expect(data.height).toBeUndefined();
    expect(data.description).toBeUndefined();
  });

  it('escapes < in JSON-LD and does not duplicate the script', () => {
    seo.setArtworkStructuredData({ ...artwork, title: '</script><b>x' });
    seo.setArtworkStructuredData({ ...artwork, title: '</script><b>x' });
    expect(jsonLdScripts().length).toBe(1);
    const text = jsonLdScripts()[0].textContent!;
    expect(text).not.toContain('<');
    expect(text).toContain('\\u003c/script>');
    expect(JSON.parse(text).name).toBe('</script><b>x');
  });

  it('removes JSON-LD when moving to another page, such as the gallery or the 404', () => {
    seo.setArtworkStructuredData(artwork);
    seo.setPage({ title: 'Galería', path: '/' });
    expect(jsonLdScripts().length).toBe(0);
    seo.setArtworkStructuredData(artwork);
    seo.setPage({ title: 'No encontrada', noindex: true });
    expect(jsonLdScripts().length).toBe(0);
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
