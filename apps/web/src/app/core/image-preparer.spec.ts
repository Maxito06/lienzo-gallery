import { TestBed } from '@angular/core/testing';
import {
  ImagePreparer,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  computeScaledSize,
  isAllowedType,
  needsReduction,
} from './image-preparer';

const fileOfType = (type: string) => new File(['x'], 'file', { type });

describe('image-preparer', () => {
  it('isAllowedType accepts jpeg, png and webp only', () => {
    expect(isAllowedType(fileOfType('image/jpeg'))).toBe(true);
    expect(isAllowedType(fileOfType('image/png'))).toBe(true);
    expect(isAllowedType(fileOfType('image/webp'))).toBe(true);
    expect(isAllowedType(fileOfType('image/gif'))).toBe(false);
    expect(isAllowedType(fileOfType('application/pdf'))).toBe(false);
  });

  it('needsReduction detects files over the byte or pixel limits', () => {
    expect(needsReduction(1000, 4000, 3000)).toBe(false);
    expect(needsReduction(MAX_IMAGE_BYTES, 1000, 1000)).toBe(false);
    expect(needsReduction(MAX_IMAGE_BYTES + 1, 1000, 1000)).toBe(true);
    expect(needsReduction(1000, 5000, 5000)).toBe(false);
    expect(needsReduction(1000, 5001, 5000)).toBe(true);
  });

  it('computeScaledSize keeps the aspect ratio and fits the pixel limit', () => {
    expect(computeScaledSize(4000, 3000)).toEqual({ width: 4000, height: 3000 });

    const scaled = computeScaledSize(8000, 6000);
    expect(Number.isInteger(scaled.width)).toBe(true);
    expect(Number.isInteger(scaled.height)).toBe(true);
    expect(scaled.width * scaled.height).toBeLessThanOrEqual(24_000_000);
    expect(scaled.width * scaled.height).toBeLessThan(MAX_IMAGE_PIXELS);
    expect(scaled.width / scaled.height).toBeCloseTo(8000 / 6000, 2);
  });

  it('prepare rejects unsupported formats', async () => {
    const preparer = TestBed.inject(ImagePreparer);
    await expect(preparer.prepare(fileOfType('application/pdf'))).rejects.toThrow('unsupported-format');
  });
});
