import { ChangeDetectionStrategy, Component } from '@angular/core';

// Marcador de posición: la gestión de obras vendrá después
@Component({
  selector: 'app-artworks-page',
  templateUrl: './artworks-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArtworksPage {}
