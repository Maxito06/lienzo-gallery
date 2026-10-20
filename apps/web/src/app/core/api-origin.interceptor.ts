import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';

// Se accede a process vía globalThis: el tsconfig de pruebas no incluye los tipos de Node
type NodeGlobal = { process?: { env: Record<string, string | undefined> } };

// En el servidor no hay Edge Function de Netlify delante, así que se llama a la API directamente.
// En el navegador no hace nada: la petición sigue yendo a /api/ del mismo origen.
export const apiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID)) || !req.url.startsWith('/api/')) {
    return next(req);
  }
  const origin = ((globalThis as NodeGlobal).process?.env['API_ORIGIN'] ?? 'http://localhost:3000').replace(/\/+$/, '');
  return next(req.clone({ url: `${origin}${req.url.slice('/api'.length)}` }));
};
