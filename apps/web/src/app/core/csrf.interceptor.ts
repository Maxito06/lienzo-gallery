import { HttpInterceptorFn } from '@angular/common/http';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Marca las peticiones que modifican datos en nuestra API con una cabecera
// personalizada (defensa CSRF). Las URLs externas, como Cloudinary, no la reciben.
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (!SAFE_METHODS.includes(req.method) && req.url.startsWith('/api/')) {
    return next(req.clone({ setHeaders: { 'X-Requested-With': 'lienzo-web' } }));
  }
  return next(req);
};
