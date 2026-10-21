import { ArtworkStatus } from '../../core/artworks.service';

export type FilterKey = 'technique' | 'series' | 'status';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  key: FilterKey;
  label: string;
  options: FilterOption[];
}

export type FilterValues = Record<FilterKey, string | null>;

export interface ActiveFilter {
  key: FilterKey;
  value: string;
  label: string;
}

// Elegir la opción ya activa la quita
export function toggleFilterValue(current: string | null, value: string): string | null {
  return current === value ? null : value;
}

// Un chip por filtro activo; si el valor no está en las opciones se muestra tal cual
export function activeFilters(groups: FilterGroup[], values: FilterValues): ActiveFilter[] {
  const result: ActiveFilter[] = [];
  for (const group of groups) {
    const value = values[group.key];
    if (value !== null) {
      const label = group.options.find((option) => option.value === value)?.label ?? value;
      result.push({ key: group.key, value, label });
    }
  }
  return result;
}

export function resultsLabel(total: number): string {
  return total === 1 ? '1 obra' : `${total} obras`;
}

export const STATUS_VALUES: ArtworkStatus[] = ['AVAILABLE', 'RESERVED', 'SOLD'];
