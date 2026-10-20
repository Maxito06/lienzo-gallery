import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Technique {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string | null;
  artworkCount: number;
}

// nameEn vacío se envía como null (la API también lo guarda como null)
export interface TechniqueInput {
  nameEs: string;
  nameEn: string | null;
}

@Injectable({ providedIn: 'root' })
export class TechniquesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Technique[]> {
    return this.http.get<Technique[]>('/api/admin/techniques');
  }

  create(input: TechniqueInput): Observable<Technique> {
    return this.http.post<Technique>('/api/admin/techniques', input);
  }

  update(id: string, input: Partial<TechniqueInput>): Observable<Technique> {
    return this.http.patch<Technique>(`/api/admin/techniques/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/techniques/${id}`);
  }
}
