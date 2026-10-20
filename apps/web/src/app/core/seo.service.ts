import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const DESCRIPTION_MAX_LENGTH = 155;

export interface SeoPageOptions {
  title: string;
  description?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
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

  // Deja siempre un estado completo: nada se hereda de la página anterior
  setPage(options: SeoPageOptions): void {
    const { title, description, image, type = 'website', noindex = false } = options;
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
