import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import {
  ARTWORK_STATUS_LABELS,
  ArtworkDetail,
  ArtworkInput,
  ArtworkStatus,
  ArtworksService,
} from '../../../core/artworks.service';
import { Series, SeriesService } from '../../../core/series.service';
import { Technique, TechniquesService } from '../../../core/techniques.service';
import { ArtworkImages } from './artwork-images';

// Mismos límites que la API (artwork-input.ts)
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_YEAR = 1000;
const MAX_YEAR = 2100;
const MAX_DIMENSION_CM = 9999.9;
const MAX_PRICE_COP = 2_000_000_000;

function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === 'number' && !Number.isInteger(value) ? { integer: true } : null;
}

// Un solo decimal, como exige la API
function oneDecimalValidator(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (typeof value !== 'number') return null;
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9 ? null : { oneDecimal: true };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

@Component({
  selector: 'app-artwork-form-page',
  imports: [ReactiveFormsModule, RouterLink, ArtworkImages],
  templateUrl: './artwork-form-page.html',
  styleUrl: './artwork-form-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkFormPage implements OnInit {
  private readonly artworks = inject(ArtworksService);
  private readonly techniquesService = inject(TechniquesService);
  private readonly seriesService = inject(SeriesService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly artworkId = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly statusOptions = (Object.keys(ARTWORK_STATUS_LABELS) as ArtworkStatus[]).map(
    (value) => ({ value, label: ARTWORK_STATUS_LABELS[value] }),
  );
  protected readonly isEdit = this.artworkId !== null;
  protected readonly techniques = signal<Technique[]>([]);
  protected readonly seriesList = signal<Series[]>([]);
  protected readonly artwork = signal<ArtworkDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(MAX_TITLE_LENGTH)]],
    year: this.fb.control<number | null>(null, [
      Validators.min(MIN_YEAR),
      Validators.max(MAX_YEAR),
      integerValidator,
    ]),
    widthCm: this.fb.control<number | null>(null, [
      Validators.min(0.1),
      Validators.max(MAX_DIMENSION_CM),
      oneDecimalValidator,
    ]),
    heightCm: this.fb.control<number | null>(null, [
      Validators.min(0.1),
      Validators.max(MAX_DIMENSION_CM),
      oneDecimalValidator,
    ]),
    status: this.fb.control<ArtworkStatus>('AVAILABLE'),
    referencePriceCop: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(MAX_PRICE_COP),
      integerValidator,
    ]),
    descriptionEs: ['', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]],
    descriptionEn: ['', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]],
    techniqueId: ['', [Validators.required]],
    seriesId: [''],
  });

  ngOnInit(): void {
    const sources: {
      techniques: Observable<Technique[]>;
      series: Observable<Series[]>;
      artwork?: Observable<ArtworkDetail>;
    } = {
      techniques: this.techniquesService.list(),
      series: this.seriesService.list(),
    };
    if (this.artworkId) {
      sources.artwork = this.artworks.get(this.artworkId);
    }

    forkJoin(sources).subscribe({
      next: ({ techniques, series, artwork }) => {
        this.techniques.set(techniques);
        this.seriesList.set(series);
        if (artwork) {
          this.artwork.set(artwork);
          this.fillForm(artwork);
        }
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.messageFor(error));
      },
    });
  }

  protected save(): void {
    if (this.techniques().length === 0) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    // Los campos vacíos se envían como null; nunca se envían publishedAt ni isDemo
    const input: ArtworkInput = {
      title: value.title.trim(),
      techniqueId: value.techniqueId,
      seriesId: value.seriesId || null,
      year: numberOrNull(value.year),
      widthCm: numberOrNull(value.widthCm),
      heightCm: numberOrNull(value.heightCm),
      status: value.status,
      referencePriceCop: numberOrNull(value.referencePriceCop),
      descriptionEs: value.descriptionEs.trim() || null,
      descriptionEn: value.descriptionEn.trim() || null,
    };

    this.errorMessage.set(null);
    this.saving.set(true);
    const request = this.artworkId
      ? this.artworks.update(this.artworkId, input)
      : this.artworks.create(input);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        // Al crear se abre la edición para poder añadir imágenes enseguida
        void this.router.navigate(
          this.isEdit ? ['/admin/artworks'] : ['/admin/artworks', saved.id, 'edit'],
        );
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(this.messageFor(error));
      },
    });
  }

  // Recarga solo la obra (imágenes y estado de publicación) sin pisar lo que se escribe en el formulario
  protected reloadArtwork(): void {
    if (!this.artworkId) {
      return;
    }
    this.artworks.get(this.artworkId).subscribe({
      next: (artwork) => this.artwork.set(artwork),
      error: (error: unknown) => this.errorMessage.set(this.messageFor(error)),
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/admin/artworks']);
  }

  private fillForm(artwork: ArtworkDetail): void {
    this.form.setValue({
      title: artwork.title,
      year: artwork.year,
      widthCm: artwork.widthCm,
      heightCm: artwork.heightCm,
      status: artwork.status,
      referencePriceCop: artwork.referencePriceCop,
      descriptionEs: artwork.descriptionEs ?? '',
      descriptionEn: artwork.descriptionEn ?? '',
      techniqueId: artwork.technique.id,
      seriesId: artwork.series?.id ?? '',
    });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado.';
    }
    if (error.status === 400) {
      return 'Revisa los datos del formulario.';
    }
    // 404 en edición: la obra se borró mientras se editaba
    if (error.status === 404 && this.isEdit) {
      return 'La obra ya no existe.';
    }
    if (error.status === 0 || error.status >= 500) {
      return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    }
    return 'Ocurrió un error inesperado.';
  }
}
