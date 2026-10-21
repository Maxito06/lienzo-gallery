import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { BRAND } from '../../../core/brand.config';
import { SeoService } from '../../../core/seo.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  protected readonly brand = BRAND;
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    inject(SeoService).setPage({ title: `Administración · ${BRAND.name}`, noindex: true });
  }

  protected logout(): void {
    // Se vuelve al login aunque la petición falle
    this.auth
      .logout()
      .pipe(finalize(() => void this.router.navigate(['/admin/login'])))
      .subscribe({ error: () => undefined });
  }
}
