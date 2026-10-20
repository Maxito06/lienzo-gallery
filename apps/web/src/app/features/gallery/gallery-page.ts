import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, merge, of, switchMap, tap } from 'rxjs';
import { ARTWORK_STATUS_LABELS, ArtworkStatus } from '../../core/artworks.service';
import { cloudinaryImageUrl } from '../../core/cloudinary.config';
import {
  PublicArtworkPage,
  PublicArtworkSummary,
  PublicCatalogService,
  PublicFilterOption,
} from '../../core/public-catalog.service';

const CARD_IMAGE_WIDTH = 600;
const VALID_STATUSES: ArtworkStatus[] = ['AVAILABLE', 'RESERVED', 'SOLD'];

interface GalleryFilters {
  series: string | null;
  technique: string | null;
  status: ArtworkStatus | null;
  page: number;
}

type GalleryState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PublicArtworkPage };

type FilterKey = 'series' | 'technique' | 'status';

// Valores inválidos de la URL se ignoran en vez de provocar un error
function parseFilters(params: ParamMap): GalleryFilters {
  const status = params.get('status');
  const page = params.get('page');
  const parsedPage = page !== null && /^\d+$/.test(page) ? Number(page) : 1;
  return {
    series: params.get('series') || null,
    technique: params.get('technique') || null,
    status: VALID_STATUSES.find((s) => s === status) ?? null,
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
  };
}

@Component({
  selector: 'app-gallery-page',
  imports: [RouterLink],
  templateUrl: './gallery-page.html',
  styleUrl: './gallery-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPage {
  private readonly catalog = inject(PublicCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly retry$ = new Subject<void>();
  private autoRetried = false;

  protected readonly statusLabels = ARTWORK_STATUS_LABELS;
  protected readonly statuses = VALID_STATUSES;
  protected readonly filters = signal<GalleryFilters>({
    series: null,
    technique: null,
    status: null,
    page: 1,
  });
  protected readonly state = signal<GalleryState>({ kind: 'loading' });

  // Los filtros se piden una sola vez; si fallan, la galería funciona sin ellos
  protected readonly techniques = toSignal(
    this.catalog.getTechniques().pipe(catchError(() => of([] as PublicFilterOption[]))),
    { initialValue: [] as PublicFilterOption[] },
  );
  protected readonly seriesOptions = toSignal(
    this.catalog.getSeries().pipe(catchError(() => of([] as PublicFilterOption[]))),
    { initialValue: [] as PublicFilterOption[] },
  );

  constructor() {
    inject(Title).setTitle('Galería · Lienzo');

    // switchMap cancela la petición anterior cuando cambia la URL
    merge(
      this.route.queryParamMap.pipe(
        map(parseFilters),
        tap((filters) => this.filters.set(filters)),
      ),
      this.retry$.pipe(map(() => this.filters())),
    )
      .pipe(
        tap(() => this.state.set({ kind: 'loading' })),
        switchMap((filters) =>
          this.catalog
            .listArtworks({
              page: filters.page,
              series: filters.series ?? undefined,
              technique: filters.technique ?? undefined,
              status: filters.status ?? undefined,
            })
            .pipe(
              map((data): GalleryState => ({ kind: 'ready', data })),
              catchError(() => of<GalleryState>({ kind: 'error' })),
            ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));

    // Si el servidor agotó el tiempo y el estado llega como error, se reintenta una vez
    afterNextRender(() => {
      if (this.state().kind === 'error' && !this.autoRetried) {
        this.autoRetried = true;
        this.retry();
      }
    });
  }

  protected hasActiveFilters(): boolean {
    const { series, technique, status } = this.filters();
    return series !== null || technique !== null || status !== null;
  }

  protected setFilter(key: FilterKey, value: string): void {
    // page: null vuelve a la página 1; un valor vacío quita el filtro de la URL
    void this.router.navigate([], {
      queryParams: { [key]: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    void this.router.navigate([], {
      queryParams: { series: null, technique: null, status: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      queryParams: { page: page <= 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected retry(): void {
    this.retry$.next();
  }

  protected imageUrl(item: PublicArtworkSummary): string | null {
    return item.primaryImagePublicId
      ? cloudinaryImageUrl(item.primaryImagePublicId, CARD_IMAGE_WIDTH)
      : null;
  }
}
