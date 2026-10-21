import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, merge, of, switchMap, tap } from 'rxjs';
import { ArtworkStatus } from '../../core/artworks.service';
import { BRAND } from '../../core/brand.config';
import { whatsappCommissionLink } from '../../core/contact.config';
import { SeoService } from '../../core/seo.service';
import { ArtworkCard } from './artwork-card';
import { FilterChange, GalleryFilters } from './gallery-filters';
import { FilterValues, STATUS_VALUES } from './gallery-filters.model';
import {
  PublicArtworkPage,
  PublicCatalogService,
  PublicFilterOption,
} from '../../core/public-catalog.service';

interface GalleryQuery {
  series: string | null;
  technique: string | null;
  status: ArtworkStatus | null;
  page: number;
}

type GalleryState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PublicArtworkPage };

// Valores inválidos de la URL se ignoran en vez de provocar un error
function parseFilters(params: ParamMap): GalleryQuery {
  const status = params.get('status');
  const page = params.get('page');
  const parsedPage = page !== null && /^\d+$/.test(page) ? Number(page) : 1;
  return {
    series: params.get('series') || null,
    technique: params.get('technique') || null,
    status: STATUS_VALUES.find((s) => s === status) ?? null,
    page: Number.isSafeInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
  };
}

@Component({
  selector: 'app-gallery-page',
  imports: [RouterLink, ArtworkCard, GalleryFilters],
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

  protected readonly brand = BRAND;
  protected readonly commissionLink = whatsappCommissionLink();
  protected readonly filters = signal<GalleryQuery>({
    series: null,
    technique: null,
    status: null,
    page: 1,
  });
  protected readonly state = signal<GalleryState>({ kind: 'loading' });
  protected readonly filterValues = computed<FilterValues>(() => {
    const { technique, series, status } = this.filters();
    return { technique, series, status };
  });
  protected readonly total = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.data.total : null;
  });

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
    inject(SeoService).setPage({
      title: `Galería · ${BRAND.name}`,
      description: 'Galería de arte con obras de dominio público: pinturas, técnicas y series.',
    });

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

  protected setFilter({ key, value }: FilterChange): void {
    // page: null vuelve a la página 1; value null quita el filtro de la URL
    void this.router.navigate([], {
      queryParams: { [key]: value, page: null },
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

}
