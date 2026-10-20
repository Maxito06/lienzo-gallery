import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, throwError } from 'rxjs';

export interface AdminUser {
  id: string;
  email: string;
}

// Forma de las respuestas de /auth/login y /auth/me
interface AdminResponse {
  admin: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AdminUser | null>(null);
  // true cuando ya se consultó /auth/me al menos una vez
  readonly checked = signal(false);

  login(email: string, password: string): Observable<AdminUser> {
    return this.http.post<AdminResponse>('/api/auth/login', { email, password }).pipe(
      map((res) => {
        this.user.set(res.admin);
        return res.admin;
      }),
    );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>('/api/auth/logout', {})
      .pipe(finalize(() => this.user.set(null)));
  }

  checkSession(): Observable<boolean> {
    return this.http.get<AdminResponse>('/api/auth/me').pipe(
      map((res) => {
        this.user.set(res.admin);
        this.checked.set(true);
        return true;
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.user.set(null);
          this.checked.set(true);
          return of(false);
        }
        return throwError(() => error);
      }),
    );
  }

  // Despierta la API (Render duerme el servicio tras un rato sin uso)
  wakeUpApi(): Observable<unknown> {
    return this.http.get('/api/health');
  }
}
