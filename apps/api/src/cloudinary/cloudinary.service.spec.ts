import { createHash } from 'node:crypto';
import { afterEach, beforeEach, vi } from 'vitest';
import { CloudinaryNotConfiguredError, CloudinaryService } from './cloudinary.service.js';

const SECRET = 'super-secret-value';
const API_KEY = '123456789';

function stubConfig() {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
  vi.stubEnv('CLOUDINARY_API_KEY', API_KEY);
  vi.stubEnv('CLOUDINARY_API_SECRET', SECRET);
  vi.stubEnv('CLOUDINARY_UPLOAD_PRESET', 'test-preset');
}

describe('CloudinaryService', () => {
  const service = new CloudinaryService();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stubConfig();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('signs an upload with the documented SHA-1 formula and never returns the secret', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const timestamp = Math.floor(now.getTime() / 1000);
    const expected = createHash('sha1')
      .update(`timestamp=${timestamp}&upload_preset=test-preset${SECRET}`)
      .digest('hex');

    const result = service.signUpload(now);

    expect(result).toEqual({
      cloudName: 'test-cloud',
      apiKey: API_KEY,
      uploadPreset: 'test-preset',
      timestamp,
      signature: expected,
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it('throws CloudinaryNotConfiguredError when a variable is missing or empty', () => {
    for (const name of [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_UPLOAD_PRESET',
    ]) {
      vi.stubEnv(name, '');
      expect(() => service.signUpload()).toThrow(CloudinaryNotConfiguredError);
      stubConfig();
    }
    vi.stubEnv('CLOUDINARY_API_KEY', undefined);
    expect(() => service.signUpload()).toThrow(CloudinaryNotConfiguredError);
  });

  it('getResource maps the response fields and sends basic auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        public_id: 'lienzo/artworks/abc',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 12345,
        extra: 'ignored',
      }),
    });

    const resource = await service.getResource('lienzo/artworks/abc');

    expect(resource).toEqual({
      publicId: 'lienzo/artworks/abc',
      format: 'jpg',
      width: 800,
      height: 600,
      bytes: 12345,
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe(
      'https://api.cloudinary.com/v1_1/test-cloud/resources/image/upload/lienzo/artworks/abc',
    );
    const expectedAuth = `Basic ${Buffer.from(`${API_KEY}:${SECRET}`).toString('base64')}`;
    expect(options.headers.Authorization).toBe(expectedAuth);
  });

  it('getResource returns null on 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(service.getResource('lienzo/artworks/missing')).resolves.toBeNull();
  });

  it('getResource throws a generic error without leaking credentials on other statuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const error = await service.getResource('lienzo/artworks/abc').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toBe('Cloudinary request failed with status 500');
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain(API_KEY);
  });

  it('deleteResources calls the delete endpoint with every public id and does nothing for an empty list', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await service.deleteResources([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await service.deleteResources(['lienzo/artworks/a', 'lienzo/artworks/b']);
    const [url, options] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(options.method).toBe('DELETE');
    expect(url).toContain('/resources/image/upload?');
    expect(url).toContain(`public_ids[]=${encodeURIComponent('lienzo/artworks/a')}`);
    expect(url).toContain(`public_ids[]=${encodeURIComponent('lienzo/artworks/b')}`);
    expect(url).toContain('invalidate=true');
  });
});
