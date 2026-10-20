import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { ArtworkDetail } from './artworks.service';
import { CLOUDINARY_CLOUD_NAME } from './cloudinary.config';

// Respuesta de POST /admin/artworks/:id/images/sign
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  timestamp: number;
  signature: string;
  // Lo genera la API y va dentro de la firma: debe enviarse como public_id
  publicId: string;
}

@Injectable({ providedIn: 'root' })
export class ArtworkImagesService {
  private readonly http = inject(HttpClient);

  private url(artworkId: string, path = ''): string {
    return `/api/admin/artworks/${artworkId}/images${path}`;
  }

  sign(artworkId: string): Observable<UploadSignature> {
    return this.http.post<UploadSignature>(this.url(artworkId, '/sign'), {});
  }

  register(artworkId: string, publicId: string): Observable<ArtworkDetail> {
    return this.http.post<ArtworkDetail>(this.url(artworkId), { publicId });
  }

  setPrimary(artworkId: string, imageId: string): Observable<ArtworkDetail> {
    return this.http.post<ArtworkDetail>(this.url(artworkId, `/${imageId}/primary`), {});
  }

  // El cuerpo debe traer exactamente los ids de las imágenes de la obra, en el nuevo orden
  reorder(artworkId: string, imageIds: string[]): Observable<ArtworkDetail> {
    return this.http.put<ArtworkDetail>(this.url(artworkId, '/order'), { imageIds });
  }

  // La API responde 200 con la obra actualizada
  remove(artworkId: string, imageId: string): Observable<ArtworkDetail> {
    return this.http.delete<ArtworkDetail>(this.url(artworkId, `/${imageId}`));
  }

  // Subida directa a Cloudinary con los campos firmados que devolvió sign.
  // La URL es externa: el interceptor CSRF no la toca y no se envían cookies.
  uploadToCloudinary(signature: UploadSignature, file: File): Observable<{ publicId: string }> {
    const cloudName = signature.cloudName || CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      return throwError(() => new Error('Cloudinary cloud name is not available'));
    }
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('upload_preset', signature.uploadPreset);
    form.append('signature', signature.signature);
    form.append('public_id', signature.publicId);

    return this.http
      .post<{ public_id: string }>(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, form)
      .pipe(map((res) => ({ publicId: res.public_id })));
  }
}
