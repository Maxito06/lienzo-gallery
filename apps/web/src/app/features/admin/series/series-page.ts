import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Series, SeriesService } from '../../../core/series.service';

// Mismo límite que la API (MAX_NAME_LENGTH)
const MAX_NAME_LENGTH = 80;

type FailedAction = 'load' | 'save' | 'delete';

@Component({
  selector: 'app-series-page',
  imports: [ReactiveFormsModule],
  templateUrl: './series-page.html',
  styleUrl: './series-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesPage implements OnInit {
  private readonly series = inject(SeriesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly items = signal<Series[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  // Id de la fila que espera confirmación para eliminarse
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nameEs: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_NAME_LENGTH)]],
    nameEn: ['', [Validators.maxLength(MAX_NAME_LENGTH)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected newItem(): void {
    this.errorMessage.set(null);
    this.editingId.set(null);
    this.form.reset();
    this.formOpen.set(true);
  }

  protected edit(item: Series): void {
    this.errorMessage.set(null);
    this.editingId.set(item.id);
    this.form.setValue({ nameEs: item.nameEs, nameEn: item.nameEn ?? '' });
    this.formOpen.set(true);
  }

  protected cancel(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nameEs, nameEn } = this.form.getRawValue();
    const input = { nameEs: nameEs.trim(), nameEn: nameEn.trim() || null };
    const id = this.editingId();
    const request = id ? this.series.update(id, input) : this.series.create(input);

    this.errorMessage.set(null);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancel();
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(this.messageFor(error, 'save'));
      },
    });
  }

  protected askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  protected cancelDelete(): void {
    this.confirmingId.set(null);
  }

  // Eliminar una serie con obras está permitido: las obras quedan sin serie
  protected confirmDelete(id: string): void {
    this.errorMessage.set(null);
    this.series.remove(id).subscribe({
      next: () => {
        this.confirmingId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.confirmingId.set(null);
        this.errorMessage.set(this.messageFor(error, 'delete'));
      },
    });
  }

  private load(): void {
    this.series.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.messageFor(error, 'load'));
      },
    });
  }

  private messageFor(error: unknown, action: FailedAction): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado.';
    }
    // 409 al guardar: el slug sale del nombre y ya existe otra serie con él
    if (error.status === 409 && action === 'save') {
      return 'Ya existe una serie con ese nombre.';
    }
    if (error.status === 400) {
      return 'Revisa los datos del formulario.';
    }
    if (error.status === 0 || error.status >= 500) {
      return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    }
    return 'Ocurrió un error inesperado.';
  }
}
