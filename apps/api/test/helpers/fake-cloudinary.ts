import type { CloudinaryResource } from '../../src/cloudinary/cloudinary.service.js';

// Sustituto de CloudinaryService para las pruebas: sin red, con estado inspeccionable
export class FakeCloudinary {
  resources = new Map<string, CloudinaryResource>();
  deleted: string[] = [];
  getResourceCalls: string[] = [];
  failWith?: Error;
  failDeleteWith?: Error;

  signUpload(publicId: string) {
    return {
      cloudName: 'test-cloud',
      apiKey: 'test-key',
      uploadPreset: 'test-preset',
      timestamp: 1700000000,
      signature: 'test-signature',
      publicId,
    };
  }

  async getResource(publicId: string): Promise<CloudinaryResource | null> {
    this.getResourceCalls.push(publicId);
    if (this.failWith) throw this.failWith;
    return this.resources.get(publicId) ?? null;
  }

  async deleteResources(publicIds: string[]): Promise<void> {
    if (this.failDeleteWith) throw this.failDeleteWith;
    for (const id of publicIds) {
      this.deleted.push(id);
      this.resources.delete(id);
    }
  }
}
