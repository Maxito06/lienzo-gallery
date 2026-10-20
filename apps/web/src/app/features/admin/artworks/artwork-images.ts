import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ArtworkImagesService } from '../../../core/artwork-images.service';
import { ArtworkImage } from '../../../core/artworks.service';
import { cloudinaryImageUrl } from '../../../core/cloudinary.config';
import { ImagePreparer } from '../../../core/image-preparer';

// Mismo límite que la API (MAX_IMAGES_PER_ARTWORK)
const MAX_IMAGES_PER_ARTWORK = 8;

type FailedStep = 'sign' | 'upload' | 'register' | 'remove' | 'action';

interface UploadStatus {
  name: string;
  phase: string;
  failed: boolean;
}

@Component({
  selector: 'app-artwork-images',
  templateUrl: './artwork-images.html',
  styleUrl: './artwork-images.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkImages {
  private readonly imagesService = inject(ArtworkImagesService);
  private readonly preparer = inject(ImagePreparer);

  readonly artworkId = input.required<string>();
  readonly images = input.required<ArtworkImage[]>();
  readonly published = input(false);
  // Avisa de que hay que recargar la obra
  readonly changed = output<void>();

  protected readonly maxImages = MAX_IMAGES_PER_ARTWORK;
  protected readonly sortedImages = computed(() =>
    [...this.images()].sort((a, b) => a.position - b.position),
  );
  protected readonly atLimit = computed(() => this.images().length >= MAX_IMAGES_PER_ARTWORK);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly uploads = signal<UploadStatus[]>([]);

  protected thumbnail(publicId: string): string | null {
    return cloudinaryImageUrl(publicId, 240);
  }

  protected makePrimary(imageId: string): void {
    this.runAction(this.imagesService.setPrimary(this.artworkId(), imageId));
  }

  protected move(index: number, offset: -1 | 1): void {
    const ids = this.sortedImages().map((image) => image.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) {
      return;
    }
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.runAction(this.imagesService.reorder(this.artworkId(), ids));
  }

  protected askDelete(imageId: string): void {
    this.confirmingId.set(imageId);
  }

  protected cancelDelete(): void {
    this.confirmingId.set(null);
  }

  protected confirmDelete(imageId: string): void {
    this.confirmingId.set(null);
    this.runAction(this.imagesService.remove(this.artworkId(), imageId), 'remove');
  }

  protected async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    if (chosen.length === 0 || this.uploading()) {
      return;
    }

    const remaining = MAX_IMAGES_PER_ARTWORK - this.images().length;
    const files = chosen.slice(0, Math.max(0, remaining));
    this.notice.set(
      chosen.length > files.length
        ? `Se subirán solo ${files.length} imágenes (máximo ${MAX_IMAGES_PER_ARTWORK} por obra).`
        : null,
    );
    this.errorMessage.set(null);
    this.uploads.set(files.map((file) => ({ name: file.name, phase: 'Preparando…', failed: false })));
    this.uploading.set(true);

    // Uno a uno: un fallo no cancela los siguientes
    for (const [index, file] of files.entries()) {
      await this.uploadOne(index, file);
    }

    this.uploading.set(false);
    // Permite elegir el mismo archivo otra vez
    input.value = '';
    this.changed.emit();
  }

  private async uploadOne(index: number, file: File): Promise<void> {
    let step: FailedStep = 'upload';
    try {
      this.setPhase(index, 'Preparando…');
      const prepared = await this.preparer.prepare(file);

      step = 'sign';
      this.setPhase(index, 'Subiendo…');
      const signature = await firstValueFrom(this.imagesService.sign(this.artworkId()));

      step = 'upload';
      const uploaded = await firstValueFrom(this.imagesService.uploadToCloudinary(signature, prepared));

      step = 'register';
      this.setPhase(index, 'Registrando…');
      await firstValueFrom(this.imagesService.register(this.artworkId(), uploaded.publicId));

      this.setPhase(index, 'Listo');
    } catch (error) {
      this.setPhase(index, this.messageFor(error, step), true);
    }
  }

  private setPhase(index: number, phase: string, failed = false): void {
    this.uploads.update((list) =>
      list.map((item, i) => (i === index ? { ...item, phase, failed } : item)),
    );
  }

  private runAction(request: Observable<unknown>, step: FailedStep = 'action'): void {
    this.errorMessage.set(null);
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(this.messageFor(error, step));
        // Si la obra o la imagen ya no existen, la vista está desactualizada
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.changed.emit();
        }
      },
    });
  }

  private messageFor(error: unknown, step: FailedStep): string {
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      if (error.message === 'unsupported-format') {
        return 'Formato no permitido. Usa JPG, PNG o WebP.';
      }
      if (error.message === 'too-large') {
        return 'No se pudo reducir la imagen por debajo de 10 MB.';
      }
      return 'Ocurrió un error inesperado.';
    }
    if (!(error instanceof HttpErrorResponse)) {
      return 'Ocurrió un error inesperado.';
    }
    // Errores de Cloudinary: solo importa si hubo conexión
    if (step === 'upload') {
      return error.status === 0
        ? 'No se pudo conectar. Inténtalo de nuevo.'
        : 'Ocurrió un error inesperado.';
    }
    switch (error.status) {
      case 503:
        return 'El servicio de imágenes no está configurado.';
      case 502:
        return 'El servicio de imágenes no responde. Inténtalo más tarde.';
      case 422:
        return 'La imagen no cumple los requisitos (formato, 10 MB o 25 megapíxeles).';
      case 409:
        // Al subir significa límite alcanzado; al eliminar, última imagen de una obra publicada
        if (step === 'remove') {
          return 'No puedes eliminar la única imagen de una obra publicada. Despublícala primero.';
        }
        if (step === 'sign' || step === 'register') {
          return 'La obra ya tiene el máximo de imágenes.';
        }
        return 'Ocurrió un error inesperado.';
      case 404:
        return 'La obra o la imagen ya no existe.';
      case 0:
        return 'No se pudo conectar. Inténtalo de nuevo.';
      default:
        return 'Ocurrió un error inesperado.';
    }
  }
}
