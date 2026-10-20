import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from '../../../core/csrf.interceptor';
import { ImagePreparer } from '../../../core/image-preparer';
import { ArtworkImages } from './artwork-images';

const SIGNATURE = {
  cloudName: 'demo-cloud',
  apiKey: 'key',
  uploadPreset: 'preset',
  timestamp: 1700000000,
  signature: 'sig',
};
const UPLOAD_URL = 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload';

const image = (id: string, position: number, isPrimary = false) => ({
  id,
  cloudinaryPublicId: `lienzo/artworks/${id}`,
  position,
  isPrimary,
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('ArtworkImages', () => {
  let fixture: ComponentFixture<ArtworkImages>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;
  let changed: Mock<() => void>;

  const setup = (images: unknown[], published = false) => {
    TestBed.configureTestingModule({
      imports: [ArtworkImages],
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        // Preparador falso: no toca el canvas ni la red
        {
          provide: ImagePreparer,
          useValue: {
            prepare: async (file: File) => {
              if (file.type === 'application/pdf') throw new Error('unsupported-format');
              return file;
            },
          },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ArtworkImages);
    fixture.componentRef.setInput('artworkId', 'a1');
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('published', published);
    changed = vi.fn<() => void>();
    fixture.componentInstance.changed.subscribe(changed);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  };

  const buttons = (text: string) =>
    Array.from(root.querySelectorAll('button')).filter((b) => b.textContent?.trim() === text);

  const chooseFiles = (files: File[]) => {
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
  };

  const jpeg = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the images with the primary label', () => {
    setup([image('i1', 1, true), image('i2', 2)]);

    expect(root.querySelectorAll('.images li').length).toBe(2);
    expect(root.querySelector('strong')?.textContent).toBe('Principal');
    expect(buttons('Hacer principal').length).toBe(1);
    // El nombre de la nube ya está configurado, así que se muestran miniaturas
    const thumbnails = Array.from(root.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(thumbnails.length).toBe(2);
    expect(thumbnails[0]).toContain('/image/upload/f_auto,q_auto,w_240/lienzo/artworks/i1');
  });

  it('uploads a file: signs, posts to Cloudinary and registers', async () => {
    setup([]);
    chooseFiles([jpeg('a.jpg')]);
    await tick();

    httpTesting.expectOne('/api/admin/artworks/a1/images/sign').flush(SIGNATURE);
    await tick();
    httpTesting.expectOne(UPLOAD_URL).flush({ public_id: 'lienzo/artworks/new' });
    await tick();
    const register = httpTesting.expectOne('/api/admin/artworks/a1/images');
    expect(register.request.body).toEqual({ publicId: 'lienzo/artworks/new' });
    register.flush({});
    await tick();
    fixture.detectChanges();

    expect(changed).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('a.jpg: Listo');
  });

  it('continues with the next file when one fails', async () => {
    setup([]);
    chooseFiles([jpeg('bad.jpg'), jpeg('good.jpg')]);
    await tick();

    httpTesting
      .expectOne('/api/admin/artworks/a1/images/sign')
      .flush({}, { status: 502, statusText: 'Bad Gateway' });
    await tick();

    httpTesting.expectOne('/api/admin/artworks/a1/images/sign').flush(SIGNATURE);
    await tick();
    httpTesting.expectOne(UPLOAD_URL).flush({ public_id: 'lienzo/artworks/good' });
    await tick();
    httpTesting.expectOne('/api/admin/artworks/a1/images').flush({});
    await tick();
    fixture.detectChanges();

    const status = root.querySelector('[role="status"]')!.textContent;
    expect(status).toContain('bad.jpg: El servicio de imágenes no responde. Inténtalo más tarde.');
    expect(status).toContain('good.jpg: Listo');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('disables the input when the limit is reached', () => {
    setup(Array.from({ length: 8 }, (_, i) => image(`i${i}`, i + 1, i === 0)));

    expect(root.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
    expect(root.textContent).toContain('Máximo 8 imágenes por obra.');
  });

  it('shows the unsupported format message', async () => {
    setup([]);
    chooseFiles([new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);
    await tick();
    fixture.detectChanges();

    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Formato no permitido. Usa JPG, PNG o WebP.',
    );
    httpTesting.expectNone('/api/admin/artworks/a1/images/sign');
  });

  it('asks for confirmation before deleting an image', () => {
    setup([image('i1', 1, true), image('i2', 2)]);
    buttons('Eliminar')[0].click();
    fixture.detectChanges();

    expect(root.textContent).toContain('¿Seguro?');
    httpTesting.expectNone('/api/admin/artworks/a1/images/i1');

    buttons('Sí')[0].click();
    const req = httpTesting.expectOne('/api/admin/artworks/a1/images/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('shows the published-last-image message on 409 when deleting', () => {
    setup([image('i1', 1, true)], true);
    buttons('Eliminar')[0].click();
    fixture.detectChanges();
    buttons('Sí')[0].click();

    httpTesting
      .expectOne('/api/admin/artworks/a1/images/i1')
      .flush({ message: 'last image' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'No puedes eliminar la única imagen de una obra publicada. Despublícala primero.',
    );
    expect(changed).not.toHaveBeenCalled();
  });

  it('moves an image up by sending the new order', () => {
    setup([image('i1', 1, true), image('i2', 2), image('i3', 3)]);

    buttons('Subir')[1].click();

    const req = httpTesting.expectOne('/api/admin/artworks/a1/images/order');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ imageIds: ['i2', 'i1', 'i3'] });
    req.flush({});
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
