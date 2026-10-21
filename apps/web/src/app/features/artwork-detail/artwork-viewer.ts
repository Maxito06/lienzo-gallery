import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { cloudinaryImageUrl } from '../../core/cloudinary.config';
import { ROOM_SCENE, computeWallPlacement, toPositiveNumber } from '../../core/room-scene.config';

// Solo los anchos ya usados en Cloudinary
const SCENE_ARTWORK_WIDTH = 600;
const THUMB_WIDTH = 600;
const FULL_WIDTH = 1200;
const SWIPE_THRESHOLD_PX = 40;

const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export interface ViewerImage {
  cloudinaryPublicId: string;
}

type ViewMode = 'wall' | 'only';

@Component({
  selector: 'app-artwork-viewer',
  templateUrl: './artwork-viewer.html',
  styleUrl: './artwork-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkViewer {
  // La imagen 0 es la principal
  readonly images = input.required<ViewerImage[]>();
  readonly title = input.required<string>();
  readonly widthCm = input<number | null>(null);
  readonly heightCm = input<number | null>(null);

  protected readonly room = ROOM_SCENE;
  protected readonly index = signal(0);
  protected readonly mode = signal<ViewMode>('wall');
  private swipeStartX: number | null = null;

  protected readonly width = computed(() => toPositiveNumber(this.widthCm()));
  protected readonly height = computed(() => toPositiveNumber(this.heightCm()));
  protected readonly placement = computed(() => computeWallPlacement(this.width(), this.height()));
  protected readonly current = computed(() => this.images()[this.index()] ?? null);
  protected readonly showWall = computed(
    () => this.index() === 0 && this.placement() !== null && this.mode() === 'wall',
  );
  protected readonly sceneLabel = computed(
    () =>
      `Obra de ${numberFormat.format(this.width() ?? 0)} por ${numberFormat.format(this.height() ?? 0)} centímetros colgada sobre un sofá`,
  );
  protected readonly scaleNote = computed(
    () =>
      `Escala real: el sofá mide ${numberFormat.format(this.room.sofaWidthCm / 100)} m y la obra ${numberFormat.format(this.width() ?? 0)} × ${numberFormat.format(this.height() ?? 0)} cm.`,
  );
  protected readonly aspectRatio = computed(() => `${this.width()} / ${this.height()}`);

  protected imageUrl(publicId: string, width: number): string | null {
    return cloudinaryImageUrl(publicId, width);
  }

  protected readonly sceneWidth = SCENE_ARTWORK_WIDTH;
  protected readonly thumbWidth = THUMB_WIDTH;
  protected readonly fullWidth = FULL_WIDTH;

  protected setMode(mode: ViewMode): void {
    this.mode.set(mode);
  }

  protected select(index: number): void {
    this.index.set(index);
  }

  protected next(): void {
    this.move(1);
  }

  protected previous(): void {
    this.move(-1);
  }

  // Gesto de deslizar: solo táctil o lápiz; el scroll vertical lo respeta touch-action: pan-y
  protected onPointerDown(event: PointerEvent): void {
    this.swipeStartX = event.pointerType === 'mouse' ? null : event.clientX;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.swipeStartX === null) {
      return;
    }
    const delta = event.clientX - this.swipeStartX;
    this.swipeStartX = null;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      this.move(delta < 0 ? 1 : -1);
    }
  }

  protected onPointerCancel(): void {
    this.swipeStartX = null;
  }

  // Navegación circular
  private move(step: number): void {
    const total = this.images().length;
    if (total > 1) {
      this.index.update((i) => (i + step + total) % total);
    }
  }
}
