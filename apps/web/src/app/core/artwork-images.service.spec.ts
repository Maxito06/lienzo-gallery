import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ArtworkImagesService, UploadSignature } from './artwork-images.service';
import { csrfInterceptor } from './csrf.interceptor';

describe('ArtworkImagesService', () => {
  let service: ArtworkImagesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ArtworkImagesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('posts the file to Cloudinary with the signed fields', () => {
    const signature: UploadSignature = {
      cloudName: 'demo-cloud',
      apiKey: 'key123',
      uploadPreset: 'preset',
      timestamp: 1700000000,
      signature: 'abc123',
      publicId: 'lienzo/artworks/xyz',
    };
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    let result: { publicId: string } | undefined;
    service.uploadToCloudinary(signature, file).subscribe((r) => (result = r));

    const req = httpTesting.expectOne('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    const body = req.request.body as FormData;
    expect(body.get('api_key')).toBe('key123');
    expect(body.get('timestamp')).toBe('1700000000');
    expect(body.get('upload_preset')).toBe('preset');
    expect(body.get('signature')).toBe('abc123');
    expect(body.get('public_id')).toBe('lienzo/artworks/xyz');
    expect((body.get('file') as File).name).toBe('photo.jpg');
    expect(Array.from(body.keys()).sort()).toEqual(
      ['api_key', 'file', 'public_id', 'signature', 'timestamp', 'upload_preset'],
    );
    req.flush({ public_id: 'lienzo/artworks/xyz' });

    expect(result).toEqual({ publicId: 'lienzo/artworks/xyz' });
  });

  it('calls the admin endpoints with the right URLs and verbs', () => {
    const expectCall = (url: string, method: string, body?: unknown) => {
      const req = httpTesting.expectOne(url);
      expect(req.request.method).toBe(method);
      if (body !== undefined) expect(req.request.body).toEqual(body);
      expect(req.request.headers.get('X-Requested-With')).toBe('lienzo-web');
      req.flush({});
    };

    service.sign('a1').subscribe();
    expectCall('/api/admin/artworks/a1/images/sign', 'POST');

    service.register('a1', 'lienzo/artworks/xyz').subscribe();
    expectCall('/api/admin/artworks/a1/images', 'POST', { publicId: 'lienzo/artworks/xyz' });

    service.setPrimary('a1', 'i1').subscribe();
    expectCall('/api/admin/artworks/a1/images/i1/primary', 'POST');

    service.reorder('a1', ['i2', 'i1']).subscribe();
    expectCall('/api/admin/artworks/a1/images/order', 'PUT', { imageIds: ['i2', 'i1'] });

    service.remove('a1', 'i1').subscribe();
    expectCall('/api/admin/artworks/a1/images/i1', 'DELETE');
  });
});
