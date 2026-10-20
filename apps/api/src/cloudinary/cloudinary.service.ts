import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export class CloudinaryNotConfiguredError extends Error {}

export type CloudinaryResource = {
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

// Cliente mínimo de Cloudinary (firma y API de administración), sin SDK
@Injectable()
export class CloudinaryService {
  // Se lee en cada llamada para no fallar al arrancar si falta la configuración
  private getConfig(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
      throw new CloudinaryNotConfiguredError('Cloudinary is not configured');
    }
    return { cloudName, apiKey, apiSecret, uploadPreset };
  }

  private authHeader(config: CloudinaryConfig): string {
    return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`;
  }

  // Firma de subida: public_id, timestamp y upload_preset en orden alfabético seguidos del secreto
  signUpload(publicId: string, now: Date = new Date()) {
    const config = this.getConfig();
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = createHash('sha1')
      .update(
        `public_id=${publicId}&timestamp=${timestamp}&upload_preset=${config.uploadPreset}${config.apiSecret}`,
      )
      .digest('hex');
    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      uploadPreset: config.uploadPreset,
      timestamp,
      signature,
      publicId,
    };
  }

  async getResource(publicId: string): Promise<CloudinaryResource | null> {
    const config = this.getConfig();
    const path = publicId.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${path}`,
      {
        headers: { Authorization: this.authHeader(config) },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloudinary request failed with status ${response.status}`);

    const body = (await response.json()) as {
      public_id: string;
      format: string;
      width: number;
      height: number;
      bytes: number;
    };
    return {
      publicId: body.public_id,
      format: body.format,
      width: body.width,
      height: body.height,
      bytes: body.bytes,
    };
  }

  async deleteResources(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;
    const config = this.getConfig();
    const query = publicIds.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join('&');
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload?${query}&invalidate=true`,
      {
        method: 'DELETE',
        headers: { Authorization: this.authHeader(config) },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`Cloudinary request failed with status ${response.status}`);
  }
}
