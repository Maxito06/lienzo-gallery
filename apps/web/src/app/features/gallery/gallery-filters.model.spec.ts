import {
  FilterGroup,
  FilterValues,
  activeFilters,
  resultsLabel,
  toggleFilterValue,
} from './gallery-filters.model';

const groups: FilterGroup[] = [
  { key: 'technique', label: 'Técnica', options: [{ value: 'oleo', label: 'Óleo' }] },
  { key: 'series', label: 'Serie', options: [{ value: 'flores', label: 'Flores' }] },
  { key: 'status', label: 'Estado', options: [{ value: 'SOLD', label: 'Vendida' }] },
];
const none: FilterValues = { technique: null, series: null, status: null };

describe('toggleFilterValue', () => {
  it('applies a value when none is active', () => {
    expect(toggleFilterValue(null, 'oleo')).toBe('oleo');
  });

  it('replaces a different active value', () => {
    expect(toggleFilterValue('acuarela', 'oleo')).toBe('oleo');
  });

  it('removes the value when the active one is chosen again', () => {
    expect(toggleFilterValue('oleo', 'oleo')).toBeNull();
  });
});

describe('activeFilters', () => {
  it('returns nothing when there are no filters', () => {
    expect(activeFilters(groups, none)).toEqual([]);
  });

  it('returns one entry per active filter with its label', () => {
    expect(activeFilters(groups, { technique: 'oleo', series: null, status: 'SOLD' })).toEqual([
      { key: 'technique', value: 'oleo', label: 'Óleo' },
      { key: 'status', value: 'SOLD', label: 'Vendida' },
    ]);
  });

  it('falls back to the raw value when the option is unknown', () => {
    expect(activeFilters(groups, { ...none, series: 'otra' })).toEqual([
      { key: 'series', value: 'otra', label: 'otra' },
    ]);
  });
});

describe('resultsLabel', () => {
  it('uses the singular for one artwork', () => {
    expect(resultsLabel(1)).toBe('1 obra');
  });

  it('uses the plural otherwise', () => {
    expect(resultsLabel(0)).toBe('0 obras');
    expect(resultsLabel(12)).toBe('12 obras');
  });
});
