import { DOCUMENT } from '@angular/common';
import { Injectable, RendererFactory2, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { BRAND } from './brand.config';

const DESCRIPTION_MAX_LENGTH = 155;

export interface SeoPageOptions {
  title: string;
  description?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  // Ruta canónica ('/' o '/obras/slug'), sin query params; se ignora si la página es noindex
  path?: string;
}

// Datos de una obra para el JSON-LD (sin precio ni ofertas)
export interface ArtworkStructuredData {
  title: string;
  slug: string;
  image: string | null;
  technique: string;
  year: number | null;
  widthCm: number | null;
  heightCm: number | null;
  description: string | null;
}

const JSON_LD_SELECTOR = "script[type='application/ld+json']";

function quantity(value: number): object {
  return { '@type': 'QuantitativeValue', value, unitCode: 'CMT', unitText: 'cm' };
}

// Serializa escapando '<' (y los separadores de línea de JS) para que el JSON no cierre el <script>
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Recorta sin cortar palabras; el resultado, con la elipsis, no pasa de maxLength
export function truncateDescription(text: string, maxLength = DESCRIPTION_MAX_LENGTH): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  const head = clean.slice(0, maxLength - 1);
  const cutsWord = clean[maxLength - 1] !== ' ';
  const lastSpace = head.lastIndexOf(' ');
  const cut = cutsWord && lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${cut.trimEnd()}…`;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);

  // Deja siempre un estado completo: nada se hereda de la página anterior
  setPage(options: SeoPageOptions): void {
    const { title, description, image, type = 'website', noindex = false, path } = options;
    this.title.setTitle(title);
    this.setOrRemove("name='description'", { name: 'description' }, description);
    this.meta.updateTag({ property: 'og:title', content: title });
    this.setOrRemove("property='og:description'", { property: 'og:description' }, description);
    this.meta.updateTag({ property: 'og:type', content: type });
    this.setOrRemove("property='og:image'", { property: 'og:image' }, image);
    this.meta.updateTag({
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    });
    this.setOrRemove("name='robots'", { name: 'robots' }, noindex ? 'noindex' : undefined);
    const canonical = path && !noindex ? `${BRAND.siteUrl}${path}` : undefined;
    this.setCanonical(canonical);
    this.setOrRemove("property='og:url'", { property: 'og:url' }, canonical);
    // Los datos estructurados son de una obra concreta: no deben sobrevivir a otra página
    this.removeStructuredData();
  }

  // JSON-LD VisualArtwork de schema.org; se crea o actualiza sin duplicar la etiqueta
  setArtworkStructuredData(artwork: ArtworkStructuredData): void {
    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'VisualArtwork',
      name: artwork.title,
      url: `${BRAND.siteUrl}/obras/${artwork.slug}`,
      artform: artwork.technique,
    };
    if (artwork.image) {
      data['image'] = artwork.image;
    }
    if (artwork.year !== null) {
      data['dateCreated'] = String(artwork.year);
    }
    if (artwork.widthCm !== null) {
      data['width'] = quantity(artwork.widthCm);
    }
    if (artwork.heightCm !== null) {
      data['height'] = quantity(artwork.heightCm);
    }
    if (artwork.description) {
      data['description'] = artwork.description;
    }

    let script = this.document.head.querySelector(JSON_LD_SELECTOR);
    if (!script) {
      script = this.renderer.createElement('script') as HTMLScriptElement;
      this.renderer.setAttribute(script, 'type', 'application/ld+json');
      this.renderer.appendChild(this.document.head, script);
    }
    script.textContent = serializeJsonLd(data);
  }

  private removeStructuredData(): void {
    const script = this.document.head.querySelector(JSON_LD_SELECTOR);
    if (script) {
      this.renderer.removeChild(this.document.head, script);
    }
  }

  private setCanonical(href: string | undefined): void {
    const head = this.document.head;
    const current = head.querySelector("link[rel='canonical']");
    if (!href) {
      if (current) {
        this.renderer.removeChild(head, current);
      }
      return;
    }
    if (current) {
      this.renderer.setAttribute(current, 'href', href);
      return;
    }
    const link = this.renderer.createElement('link') as HTMLLinkElement;
    this.renderer.setAttribute(link, 'rel', 'canonical');
    this.renderer.setAttribute(link, 'href', href);
    this.renderer.appendChild(head, link);
  }

  private setOrRemove(
    selector: string,
    attribute: { name: string } | { property: string },
    content: string | undefined,
  ): void {
    if (content) {
      this.meta.updateTag({ ...attribute, content });
    } else {
      this.meta.removeTag(selector);
    }
  }
}
