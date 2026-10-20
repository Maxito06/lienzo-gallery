import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type ArtworkStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';

export const ARTWORK_STATUS_LABELS: Record<ArtworkStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Reservada',
  SOLD: 'Vendida',
};

export interface NamedRef {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string | null;
}

// widthCm y heightCm: la API los convierte con toNumber(), así que llegan como número (o null)
export interface ArtworkSummary {
  id: string;
  slug: string;
  title: string;
  status: ArtworkStatus;
  isPublished: boolean;
  publishedAt: string | null;
  isDemo: boolean;
  year: number | null;
  widthCm: number | null;
  heightCm: number | null;
  referencePriceCop: number | null;
  technique: NamedRef;
  series: NamedRef | null;
  imageCount: number;
  // La lista solo trae el publicId de Cloudinary, no una URL
  primaryImagePublicId: string | null;
}

export interface ArtworkImage {
  id: string;
  cloudinaryPublicId: string;
  position: number;
  isPrimary: boolean;
}

export interface ArtworkDetail extends ArtworkSummary {
  descriptionEs: string | null;
  descriptionEn: string | null;
  createdAt: string;
  updatedAt: string;
  images: ArtworkImage[];
}

// Nunca incluye publishedAt, slug ni isDemo: la API no los acepta aquí
export interface ArtworkInput {
  title: string;
  techniqueId: string;
  seriesId: string | null;
  year: number | null;
  widthCm: number | null;
  heightCm: number | null;
  status: ArtworkStatus;
  referencePriceCop: number | null;
  descriptionEs: string | null;
  descriptionEn: string | null;
}

@Injectable({ providedIn: 'root' })
export class ArtworksService {
  private readonly http = inject(HttpClient);

  list(): Observable<ArtworkSummary[]> {
    return this.http.get<ArtworkSummary[]>('/api/admin/artworks');
  }

  get(id: string): Observable<ArtworkDetail> {
    return this.http.get<ArtworkDetail>(`/api/admin/artworks/${id}`);
  }

  create(input: ArtworkInput): Observable<ArtworkDetail> {
    return this.http.post<ArtworkDetail>('/api/admin/artworks', input);
  }

  // La API usa PATCH (cambios parciales)
  update(id: string, input: Partial<ArtworkInput>): Observable<ArtworkDetail> {
    return this.http.patch<ArtworkDetail>(`/api/admin/artworks/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/artworks/${id}`);
  }

  publish(id: string): Observable<ArtworkDetail> {
    return this.http.post<ArtworkDetail>(`/api/admin/artworks/${id}/publish`, {});
  }

  unpublish(id: string): Observable<ArtworkDetail> {
    return this.http.post<ArtworkDetail>(`/api/admin/artworks/${id}/unpublish`, {});
  }
}
