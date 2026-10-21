import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ARTWORK_STATUS_LABELS } from '../../core/artworks.service';
import { PublicFilterOption } from '../../core/public-catalog.service';
import { FilterDropdown } from './filter-dropdown';
import {
  FilterGroup,
  FilterKey,
  FilterValues,
  STATUS_VALUES,
  activeFilters,
  resultsLabel,
  toggleFilterValue,
} from './gallery-filters.model';

export interface FilterChange {
  key: FilterKey;
  // null quita el filtro
  value: string | null;
}

@Component({
  selector: 'app-gallery-filters',
  imports: [FilterDropdown],
  templateUrl: './gallery-filters.html',
  styleUrl: './gallery-filters.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryFilters {
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly techniques = input.required<PublicFilterOption[]>();
  readonly series = input.required<PublicFilterOption[]>();
  readonly values = input.required<FilterValues>();
  // null mientras se carga: el contador no se muestra
  readonly total = input<number | null>(null);

  readonly filterChange = output<FilterChange>();
  readonly cleared = output<void>();

  protected readonly groups = computed<FilterGroup[]>(() => [
    {
      key: 'technique',
      label: 'Técnica',
      options: this.techniques().map((o) => ({ value: o.slug, label: o.nameEs })),
    },
    {
      key: 'series',
      label: 'Serie',
      options: this.series().map((o) => ({ value: o.slug, label: o.nameEs })),
    },
    {
      key: 'status',
      label: 'Estado',
      options: STATUS_VALUES.map((s) => ({ value: s, label: ARTWORK_STATUS_LABELS[s] })),
    },
  ]);
  protected readonly active = computed(() => activeFilters(this.groups(), this.values()));
  protected readonly totalLabel = computed(() => {
    const total = this.total();
    return total === null ? null : resultsLabel(total);
  });

  protected choose(key: FilterKey, value: string): void {
    this.filterChange.emit({ key, value: toggleFilterValue(this.values()[key], value) });
  }

  protected remove(key: FilterKey): void {
    this.filterChange.emit({ key, value: null });
  }

  // showModal solo se llama al hacer clic, es decir, en el navegador
  protected openDialog(): void {
    this.dialog()?.nativeElement.showModal();
  }

  protected closeDialog(): void {
    this.dialog()?.nativeElement.close();
  }
}
