import { FetchBackend, HttpBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Se accede a process vía globalThis: el tsconfig de pruebas no incluye los tipos de Node
type NodeGlobal = { process?: { env: Record<string, string | undefined> } };

// Solo se registra en el servidor, donde no hay Edge Function de Netlify delante y se llama
// a la API directamente. Se reescribe aquí, en el backend y después de la caché de
// transferencia, para que servidor y navegador compartan la misma clave ('/api/...').
@Injectable()
export class ApiOriginBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith('/api/')) {
      return this.fetchBackend.handle(req);
    }
    const origin = (
      (globalThis as NodeGlobal).process?.env['API_ORIGIN'] ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    return this.fetchBackend.handle(req.clone({ url: `${origin}${req.url.slice('/api'.length)}` }));
  }
}
