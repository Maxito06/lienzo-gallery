import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  // Va antes que 'admin' para que el guard no la capture
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/login/login').then((m) => m.Login),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'artworks' },
      {
        path: 'artworks',
        loadComponent: () =>
          import('./features/admin/artworks/artworks-page').then((m) => m.ArtworksPage),
      },
      {
        path: 'artworks/new',
        loadComponent: () =>
          import('./features/admin/artworks/artwork-form-page').then((m) => m.ArtworkFormPage),
      },
      {
        path: 'artworks/:id/edit',
        loadComponent: () =>
          import('./features/admin/artworks/artwork-form-page').then((m) => m.ArtworkFormPage),
      },
      {
        path: 'techniques',
        loadComponent: () =>
          import('./features/admin/techniques/techniques-page').then((m) => m.TechniquesPage),
      },
      {
        path: 'series',
        loadComponent: () => import('./features/admin/series/series-page').then((m) => m.SeriesPage),
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/gallery/gallery-page').then((m) => m.GalleryPage),
  },
  {
    path: 'obras/:slug',
    loadComponent: () =>
      import('./features/artwork-detail/artwork-detail-page').then((m) => m.ArtworkDetailPage),
  },
  { path: '**', redirectTo: '' },
];
