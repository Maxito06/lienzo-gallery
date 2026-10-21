import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ARTWORK_STATUS_LABELS, ArtworkSummary, ArtworksService } from '../../../core/artworks.service';
import { publicationBadgeClass, saleStatusBadgeClass } from '../status-badge';
import { cloudinaryImageUrl } from '../../../core/cloudinary.config';

type FailedAction = 'load' | 'publish' | 'unpublish' | 'delete';

@Component({
  selector: 'app-artworks-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './artworks-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworksPage implements OnInit {
  private readonly artworks = inject(ArtworksService);

  protected readonly statusLabels = ARTWORK_STATUS_LABELS;
  protected readonly saleBadge = saleStatusBadgeClass;
  protected readonly publicationBadge = publicationBadgeClass;

  protected thumbnail(publicId: string | null): string | null {
    return publicId ? cloudinaryImageUrl(publicId, 80) : null;
  }
  protected readonly items = signal<ArtworkSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  // Fila con una acción en curso: solo una a la vez
  protected readonly busyId = signal<string | null>(null);
  // Fila que espera confirmación para eliminarse
  protected readonly confirmingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected publish(id: string): void {
    this.run(id, this.artworks.publish(id), 'publish');
  }

  protected unpublish(id: string): void {
    this.run(id, this.artworks.unpublish(id), 'unpublish');
  }

  protected askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  protected cancelDelete(): void {
    this.confirmingId.set(null);
  }

  protected confirmDelete(id: string): void {
    this.confirmingId.set(null);
    this.run(id, this.artworks.remove(id), 'delete');
  }

  private run(id: string, request: Observable<unknown>, action: FailedAction): void {
    this.errorMessage.set(null);
    this.busyId.set(id);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.errorMessage.set(this.messageFor(error, action));
        // Si la obra ya no existe, la lista está desactualizada
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.load();
        }
      },
    });
  }

  private load(): void {
    this.artworks.list().subscribe({
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
    // 409 al publicar: la API exige una imagen principal
    if (error.status === 409 && action === 'publish') {
      return 'Para publicar, la obra necesita al menos una imagen principal.';
    }
    if (error.status === 404) {
      return 'La obra ya no existe.';
    }
    if (error.status === 400) {
      return 'Revisa los datos.';
    }
    if (error.status === 0 || error.status >= 500) {
      return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    }
    return 'Ocurrió un error inesperado.';
  }
}
