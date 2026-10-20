import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/login/login').then((m) => m.Login),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/dashboard/dashboard').then((m) => m.Dashboard),
  },
  // TEMPORAL: se reemplaza por la galería pública
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
