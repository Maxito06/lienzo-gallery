import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArtworkViewer } from './artwork-viewer';

const images = [
  { cloudinaryPublicId: 'main' },
  { cloudinaryPublicId: 'second' },
  { cloudinaryPublicId: 'third' },
];

describe('ArtworkViewer', () => {
  let fixture: ComponentFixture<ArtworkViewer>;
  let root: HTMLElement;

  const render = (inputs: Record<string, unknown>) => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ArtworkViewer);
    root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('title', 'Sunset');
    for (const [key, value] of Object.entries({ images, widthCm: 100, heightCm: 75, ...inputs })) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  };

  const click = (selector: string) => {
    root.querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  const swipe = (from: number, to: number, pointerType = 'touch') => {
    const stage = root.querySelector('.stage')!;
    const make = (type: string, x: number) =>
      Object.assign(new Event(type, { bubbles: true }), { clientX: x, pointerType });
    stage.dispatchEvent(make('pointerdown', from));
    stage.dispatchEvent(make('pointerup', to));
    fixture.detectChanges();
  };

  it('shows the main image on the wall scene by default', () => {
    render({});
    const scene = root.querySelector('.scene')!;
    expect(scene.getAttribute('role')).toBe('img');
    expect(scene.getAttribute('aria-label')).toBe(
      'Obra de 100 por 75 centímetros colgada sobre un sofá',
    );
    const room = scene.querySelector('img.room')!;
    expect(room.getAttribute('src')).toBe('/images/sala-demo.jpg');
    expect(room.getAttribute('fetchpriority')).toBe('high');
    expect(scene.querySelector('img.artwork')?.getAttribute('src')).toContain('main');
    expect(root.querySelector('.note')?.textContent).toContain(
      'Escala real: el sofá mide 2,1 m y la obra 100 × 75 cm.',
    );
  });

  it('places the artwork with the computed percentages', () => {
    render({});
    const artwork = root.querySelector<HTMLElement>('img.artwork')!;
    expect(parseFloat(artwork.style.width)).toBeCloseTo(32.9, 1);
    expect(parseFloat(artwork.style.left)).toBeCloseTo(34.46, 1);
    expect(parseFloat(artwork.style.top)).toBeCloseTo(17.6, 1);
  });

  it('shows neither the wall view nor the mode selector without measurements', () => {
    render({ widthCm: null, heightCm: null });
    expect(root.querySelector('.scene')).toBeNull();
    expect(root.querySelector('.modes')).toBeNull();
    expect(root.querySelector('.note')).toBeNull();
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('main');
  });

  it('shows only the photo when the artwork does not fit on the wall', () => {
    render({ widthCm: 400, heightCm: 300 });
    expect(root.querySelector('.scene')).toBeNull();
    expect(root.querySelector('.modes')).toBeNull();
  });

  it('explains why the wall view is missing only for artworks that are too large', () => {
    const message = 'Por sus medidas, esta obra no cabe en la vista de pared de ejemplo.';
    render({ widthCm: 400, heightCm: 300 });
    expect(root.querySelector('.note')?.textContent).toBe(message);
    click('button[aria-label="Foto siguiente"]');
    expect(root.querySelector('.note')).toBeNull();
  });

  it('shows no too-large note when the artwork fits or has no measurements', () => {
    render({});
    expect(root.textContent).not.toContain('no cabe en la vista de pared');
    TestBed.resetTestingModule();
    render({ widthCm: null, heightCm: null });
    expect(root.querySelector('.note')).toBeNull();
  });

  it('toggles between the wall and the artwork only', () => {
    render({});
    const [wall, only] = Array.from(root.querySelectorAll<HTMLButtonElement>('.modes button'));
    expect(wall.getAttribute('aria-pressed')).toBe('true');
    only.click();
    fixture.detectChanges();
    expect(only.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.scene')).toBeNull();
    expect(root.querySelector('.note')).toBeNull();
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('main');
    wall.click();
    fixture.detectChanges();
    expect(root.querySelector('.scene')).not.toBeNull();
  });

  it('moves to the next and previous photo, wrapping around', () => {
    render({});
    click('button[aria-label="Foto siguiente"]');
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('second');
    expect(root.querySelector('.modes')).toBeNull();
    expect(root.querySelector('.note')).toBeNull();
    click('button[aria-label="Foto siguiente"]');
    click('button[aria-label="Foto siguiente"]');
    expect(root.querySelector('.scene')).not.toBeNull();
    click('button[aria-label="Foto anterior"]');
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('third');
  });

  it('navigates with the arrow keys', () => {
    render({});
    const viewer = root.querySelector('.viewer')!;
    viewer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('second');
    viewer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    fixture.detectChanges();
    expect(root.querySelector('.scene')).not.toBeNull();
  });

  it('changes photo on a touch swipe past the threshold only', () => {
    render({});
    swipe(200, 180);
    expect(root.querySelector('.scene')).not.toBeNull();
    swipe(200, 100);
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('second');
    swipe(100, 200);
    expect(root.querySelector('.scene')).not.toBeNull();
  });

  it('ignores mouse drags', () => {
    render({});
    swipe(200, 100, 'mouse');
    expect(root.querySelector('.scene')).not.toBeNull();
  });

  it('marks the current thumbnail and jumps to the chosen photo', () => {
    render({});
    expect(
      root.querySelector('.thumbnails [aria-current="true"]')?.getAttribute('aria-label'),
    ).toBe('Foto 1');
    click('button[aria-label="Foto 3"]');
    expect(root.querySelector('.solo img')?.getAttribute('src')).toContain('third');
  });

  it('has no arrows or thumbnails with a single image', () => {
    render({ images: [images[0]] });
    expect(root.querySelector('.arrow')).toBeNull();
    expect(root.querySelector('.thumbnails')).toBeNull();
    expect(root.querySelector('.scene')).not.toBeNull();
  });
});
