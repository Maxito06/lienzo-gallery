import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Series {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string | null;
  artworkCount: number;
}

// nameEn vacío se envía como null (la API también lo guarda como null)
export interface SeriesInput {
  nameEs: string;
  nameEn: string | null;
}

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Series[]> {
    return this.http.get<Series[]>('/api/admin/series');
  }

  create(input: SeriesInput): Observable<Series> {
    return this.http.post<Series>('/api/admin/series', input);
  }

  update(id: string, input: Partial<SeriesInput>): Observable<Series> {
    return this.http.patch<Series>(`/api/admin/series/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/series/${id}`);
  }
}
