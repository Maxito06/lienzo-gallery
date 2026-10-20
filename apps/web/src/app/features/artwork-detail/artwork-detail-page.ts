import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  RESPONSE_INIT,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, merge, of, switchMap, tap } from 'rxjs';
import { ARTWORK_STATUS_LABELS } from '../../core/artworks.service';
import { cloudinaryImageUrl } from '../../core/cloudinary.config';
import { whatsappLink } from '../../core/contact.config';
import { PublicArtworkDetail, PublicCatalogService } from '../../core/public-catalog.service';

const MAIN_IMAGE_WIDTH = 1200;
const THUMB_IMAGE_WIDTH = 120;
const DESCRIPTION_MAX_LENGTH = 155;
const FALLBACK_DESCRIPTION = 'Obra de la galería Lienzo.';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error' }
  | { kind: 'ready'; artwork: PublicArtworkDetail };

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

const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const priceFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

@Component({
  selector: 'app-artwork-detail-page',
  imports: [RouterLink],
  templateUrl: './artwork-detail-page.html',
  styleUrl: './artwork-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkDetailPage {
  private readonly catalog = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  // Solo existe en el servidor; en el navegador es null
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly retry$ = new Subject<void>();
  private readonly slug = signal('');
  private autoRetried = false;

  protected readonly statusLabels = ARTWORK_STATUS_LABELS;
  protected readonly state = signal<DetailState>({ kind: 'loading' });
  protected readonly index = signal(0);

  protected readonly artwork = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.artwork : null;
  });
  protected readonly images = computed(() =>
    [...(this.artwork()?.images ?? [])].sort((a, b) => a.position - b.position),
  );
  protected readonly currentImage = computed(() => this.images()[this.index()] ?? null);
  protected readonly whatsapp = computed(() => {
    const artwork = this.artwork();
    return artwork ? whatsappLink(artwork.title) : null;
  });
  protected readonly dimensions = computed(() => {
    const artwork = this.artwork();
    if (!artwork || artwork.widthCm === null || artwork.heightCm === null) {
      return null;
    }
    return `${numberFormat.format(artwork.widthCm)} × ${numberFormat.format(artwork.heightCm)} cm`;
  });
  protected readonly price = computed(() => {
    const price = this.artwork()?.referencePriceCop;
    return price === null || price === undefined ? null : priceFormat.format(price);
  });

  constructor() {
    // switchMap cancela la petición anterior cuando cambia el slug
    merge(
      this.route.paramMap.pipe(
        map((params) => params.get('slug') ?? ''),
        tap((slug) => this.slug.set(slug)),
      ),
      this.retry$.pipe(map(() => this.slug())),
    )
      .pipe(
        tap(() => this.state.set({ kind: 'loading' })),
        switchMap((slug) =>
          this.catalog.getArtwork(slug).pipe(
            map((artwork): DetailState => ({ kind: 'ready', artwork })),
            catchError((error: unknown) =>
              of<DetailState>({
                kind: error instanceof HttpErrorResponse && error.status === 404 ? 'notFound' : 'error',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.applyState(state));

    // Si el servidor agotó el tiempo y el estado llega como error, se reintenta una vez
    afterNextRender(() => {
      if (this.state().kind === 'error' && !this.autoRetried) {
        this.autoRetried = true;
        this.retry();
      }
    });
  }

  protected retry(): void {
    this.retry$.next();
  }

  protected next(): void {
    this.move(1);
  }

  protected previous(): void {
    this.move(-1);
  }

  protected select(index: number): void {
    this.index.set(index);
  }

  protected imageUrl(publicId: string, width: number): string | null {
    return cloudinaryImageUrl(publicId, width);
  }

  protected readonly mainWidth = MAIN_IMAGE_WIDTH;
  protected readonly thumbWidth = THUMB_IMAGE_WIDTH;

  // Navegación circular
  private move(step: number): void {
    const total = this.images().length;
    if (total > 1) {
      this.index.update((i) => (i + step + total) % total);
    }
  }

  private applyState(state: DetailState): void {
    this.state.set(state);
    if (state.kind === 'ready') {
      const images = [...state.artwork.images].sort((a, b) => a.position - b.position);
      // Empieza en la imagen principal
      this.index.set(Math.max(0, images.findIndex((image) => image.isPrimary)));
      this.applyMeta(state.artwork, images[this.index()]?.cloudinaryPublicId ?? null);
    } else if (state.kind === 'notFound') {
      if (this.responseInit) {
        this.responseInit.status = 404;
      }
      this.title.setTitle('Obra no encontrada · Lienzo');
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
    }
  }

  private applyMeta(artwork: PublicArtworkDetail, primaryPublicId: string | null): void {
    const description = artwork.descriptionEs
      ? truncateDescription(artwork.descriptionEs) || FALLBACK_DESCRIPTION
      : FALLBACK_DESCRIPTION;
    const pageTitle = `${artwork.title} · Lienzo`;
    this.title.setTitle(pageTitle);
    this.meta.removeTag("name='robots'");
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    const image = primaryPublicId ? cloudinaryImageUrl(primaryPublicId, MAIN_IMAGE_WIDTH) : null;
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
    }
  }
}
