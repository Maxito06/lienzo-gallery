import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timer } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { SeoService } from '../../../core/seo.service';

const WAKING_NOTICE_DELAY_MS = 3000;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(1024)]],
  });
  protected readonly submitting = signal(false);
  protected readonly waking = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    inject(SeoService).setPage({ title: 'Administración · Lienzo', noindex: true });

    // Despierta la API sin esperar; si tarda, avisa al usuario
    const noticeTimer = timer(WAKING_NOTICE_DELAY_MS).subscribe(() => this.waking.set(true));
    this.auth
      .wakeUpApi()
      .pipe(
        finalize(() => {
          noticeTimer.unsubscribe();
          this.waking.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/admin']);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.messageFor(error));
      },
    });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado.';
    }
    if (error.status === 401) {
      return 'Correo o contraseña incorrectos.';
    }
    if (error.status === 429) {
      const seconds = Number(error.headers.get('Retry-After'));
      const minutes = Math.max(1, Math.ceil((Number.isFinite(seconds) ? seconds : 0) / 60));
      const unit = minutes === 1 ? 'minuto' : 'minutos';
      return `Demasiados intentos. Vuelve a intentarlo en ${minutes} ${unit}.`;
    }
    if (error.status === 0 || error.status >= 500) {
      return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    }
    return 'Ocurrió un error inesperado.';
  }
}
