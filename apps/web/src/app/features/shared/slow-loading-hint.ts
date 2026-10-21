import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';

export const SLOW_LOADING_DELAY_MS = 4000;

// Aviso para el arranque en frío de la API. Se coloca dentro del estado de carga: al llegar los datos
// o fallar, el componente se destruye y el aviso desaparece. afterNextRender solo corre en el navegador.
@Component({
  selector: 'app-slow-loading-hint',
  template: `
    @if (visible()) {
      <p class="hint" role="status">
        La galería estaba en reposo y está despertando. La primera visita puede tardar hasta 30
        segundos.
      </p>
    }
  `,
  styles: `
    .hint {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      color: var(--color-ink-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlowLoadingHint {
  protected readonly visible = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const timer = setTimeout(() => this.visible.set(true), SLOW_LOADING_DELAY_MS);
      destroyRef.onDestroy(() => clearTimeout(timer));
    });
  }
}
