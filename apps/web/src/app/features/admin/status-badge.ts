import { ArtworkStatus } from '../../core/artworks.service';

// Clase de insignia según el estado; el texto siempre se muestra aparte
export function saleStatusBadgeClass(status: ArtworkStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'adm-badge--ok';
    case 'RESERVED':
      return 'adm-badge--warn';
    default:
      return 'adm-badge--muted';
  }
}

export function publicationBadgeClass(isPublished: boolean): string {
  return isPublished ? 'adm-badge--ok' : 'adm-badge--draft';
}
