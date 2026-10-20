import { Injectable } from '@angular/core';

// Deben coincidir con los límites de la API y del plan gratuito de Cloudinary
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const TARGET_BYTES = 9 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Margen bajo el límite de píxeles al reducir
const SAFE_PIXELS = 24_000_000;
const QUALITIES = [0.9, 0.8, 0.7, 0.6];
const SHRINK_FACTOR = 0.85;
const MAX_ITERATIONS = 8;

export function isAllowedType(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}

export function needsReduction(bytes: number, width: number, height: number): boolean {
  return bytes > MAX_IMAGE_BYTES || width * height > MAX_IMAGE_PIXELS;
}

// Mantiene la proporción; si ya cabe, devuelve el mismo tamaño
export function computeScaledSize(width: number, height: number): { width: number; height: number } {
  if (width * height <= SAFE_PIXELS) {
    return { width, height };
  }
  const factor = Math.sqrt(SAFE_PIXELS / (width * height));
  return {
    width: Math.max(1, Math.floor(width * factor)),
    height: Math.max(1, Math.floor(height * factor)),
  };
}

@Injectable({ providedIn: 'root' })
export class ImagePreparer {
  // Devuelve el archivo original si cumple los límites; si no, una copia JPEG reducida
  async prepare(file: File): Promise<File> {
    if (!isAllowedType(file)) {
      throw new Error('unsupported-format');
    }
    // 'from-image' respeta la orientación EXIF
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      if (!needsReduction(file.size, bitmap.width, bitmap.height)) {
        return file;
      }
      let { width, height } = computeScaledSize(bitmap.width, bitmap.height);
      for (let attempt = 0; attempt < MAX_ITERATIONS; attempt++) {
        for (const quality of QUALITIES) {
          const blob = await this.render(bitmap, width, height, quality);
          if (blob.size <= TARGET_BYTES) {
            return new File([blob], this.jpegName(file.name), { type: 'image/jpeg' });
          }
        }
        width = Math.max(1, Math.floor(width * SHRINK_FACTOR));
        height = Math.max(1, Math.floor(height * SHRINK_FACTOR));
      }
      throw new Error('too-large');
    } finally {
      bitmap.close();
    }
  }

  private jpegName(name: string): string {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    return `${base}.jpg`;
  }

  private async render(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      this.draw(canvas.getContext('2d'), bitmap, width, height);
      return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.draw(canvas.getContext('2d'), bitmap, width, height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('too-large'))),
        'image/jpeg',
        quality,
      );
    });
  }

  // Fondo blanco previo por si el original era un PNG con transparencia
  private draw(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null,
    bitmap: ImageBitmap,
    width: number,
    height: number,
  ): void {
    if (!context) {
      throw new Error('too-large');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
  }
}
