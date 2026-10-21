import { publicationBadgeClass, saleStatusBadgeClass } from './status-badge';

describe('saleStatusBadgeClass', () => {
  it('maps each sale status to its badge variant', () => {
    expect(saleStatusBadgeClass('AVAILABLE')).toBe('adm-badge--ok');
    expect(saleStatusBadgeClass('RESERVED')).toBe('adm-badge--warn');
    expect(saleStatusBadgeClass('SOLD')).toBe('adm-badge--muted');
  });
});

describe('publicationBadgeClass', () => {
  it('maps published and draft to their badge variants', () => {
    expect(publicationBadgeClass(true)).toBe('adm-badge--ok');
    expect(publicationBadgeClass(false)).toBe('adm-badge--draft');
  });
});
