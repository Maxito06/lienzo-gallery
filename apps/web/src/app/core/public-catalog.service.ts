import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { ArtworkStatus } from './artworks.service';

// Límite en el servidor para no dejar colgado el renderizado
const SERVER_TIMEOUT_MS = 8000;

// La API pública no expone el id de técnicas ni series
export interface PublicNamedRef {
  slug: string;
  nameEs: string;
  nameEn: string | null;
}

export interface PublicFilterOption extends PublicNamedRef {
  artworkCount: number;
}

export interface PublicArtworkSummary {
  slug: string;
  title: string;
  status: ArtworkStatus;
  year: number | null;
  isDemo: boolean;
  technique: PublicNamedRef;
  series: PublicNamedRef | null;
  primaryImagePublicId: string | null;
}

export interface PublicArtworkPage {
  items: PublicArtworkSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicArtworkQuery {
  page?: number;
  pageSize?: number;
  series?: string;
  technique?: string;
  status?: ArtworkStatus;
}

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private readonly http = inject(HttpClient);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  listArtworks(query: PublicArtworkQuery = {}): Observable<PublicArtworkPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    }
    return this.withTimeout(this.http.get<PublicArtworkPage>('/api/public/artworks', { params }));
  }

  getTechniques(): Observable<PublicFilterOption[]> {
    return this.withTimeout(this.http.get<PublicFilterOption[]>('/api/public/techniques'));
  }

  getSeries(): Observable<PublicFilterOption[]> {
    return this.withTimeout(this.http.get<PublicFilterOption[]>('/api/public/series'));
  }

  private withTimeout<T>(source: Observable<T>): Observable<T> {
    return this.isServer ? source.pipe(timeout(SERVER_TIMEOUT_MS)) : source;
  }
}
