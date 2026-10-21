import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ARTWORK_STATUS_LABELS } from '../../core/artworks.service';
import { cloudinaryImageUrl } from '../../core/cloudinary.config';
import { PublicArtworkSummary } from '../../core/public-catalog.service';

const CARD_IMAGE_WIDTH = 600;

@Component({
  selector: 'app-artwork-card',
  imports: [RouterLink],
  templateUrl: './artwork-card.html',
  styleUrl: './artwork-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworkCard {
  readonly artwork = input.required<PublicArtworkSummary>();
  // Las primeras tarjetas cargan la imagen de inmediato
  readonly eager = input(false);
  readonly highPriority = input(false);

  protected readonly statusLabel = computed(() => ARTWORK_STATUS_LABELS[this.artwork().status]);
  protected readonly imageUrl = computed(() => {
    const id = this.artwork().primaryImagePublicId;
    return id ? cloudinaryImageUrl(id, CARD_IMAGE_WIDTH) : null;
  });
  protected readonly details = computed(() => {
    const { technique, year } = this.artwork();
    return year ? `${technique.nameEs} · ${year}` : technique.nameEs;
  });
}
