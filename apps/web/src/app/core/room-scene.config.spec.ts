import {
  ROOM_SCENE,
  computeWallPlacement,
  toPositiveNumber,
  wallPlacementStatus,
} from './room-scene.config';

describe('computeWallPlacement', () => {
  it('places a 100x75 cm artwork using the calibration values', () => {
    const placement = computeWallPlacement(100, 75)!;
    expect(placement.width).toBeCloseTo(32.9, 1);
    expect(placement.left).toBeCloseTo(34.46, 1);
    expect(placement.top).toBeCloseTo(17.6, 1);
  });

  it('returns null for an artwork that does not fit', () => {
    expect(computeWallPlacement(300, 100)).toBeNull();
    expect(computeWallPlacement(100, 200)).toBeNull();
  });

  it('returns null for missing or invalid measurements', () => {
    expect(computeWallPlacement(null, 50)).toBeNull();
    expect(computeWallPlacement(50, undefined)).toBeNull();
    expect(computeWallPlacement(0, 50)).toBeNull();
    expect(computeWallPlacement(50, -10)).toBeNull();
    expect(computeWallPlacement(Number.NaN, 50)).toBeNull();
  });

  it('fits a small artwork', () => {
    const placement = computeWallPlacement(20, 30)!;
    expect(placement.width).toBeCloseTo(6.58, 1);
    expect(placement.top).toBeGreaterThan(3);
  });

  it('accepts measurements that arrive as strings', () => {
    expect(computeWallPlacement('100', '75')?.width).toBeCloseTo(32.9, 1);
  });
});

describe('wallPlacementStatus', () => {
  it('returns ok for a normal artwork', () => {
    expect(wallPlacementStatus(100, 75)).toBe('ok');
  });

  it('returns too-large for a huge artwork', () => {
    expect(wallPlacementStatus(300, 100)).toBe('too-large');
  });

  it('returns too-large for a tall and narrow artwork that does not fit', () => {
    expect(wallPlacementStatus(30, 200)).toBe('too-large');
  });

  it('returns missing for null, zero, negative or NaN measurements', () => {
    expect(wallPlacementStatus(null, 50)).toBe('missing');
    expect(wallPlacementStatus(0, 50)).toBe('missing');
    expect(wallPlacementStatus(50, -10)).toBe('missing');
    expect(wallPlacementStatus(Number.NaN, 50)).toBe('missing');
  });
});

describe('toPositiveNumber', () => {
  it('normalizes numbers and numeric strings, and rejects the rest', () => {
    expect(toPositiveNumber('50.5')).toBe(50.5);
    expect(toPositiveNumber(12)).toBe(12);
    expect(toPositiveNumber('')).toBeNull();
    expect(toPositiveNumber('abc')).toBeNull();
    expect(toPositiveNumber(0)).toBeNull();
  });
});

describe('ROOM_SCENE', () => {
  it('points to the room image with an empty alt', () => {
    expect(ROOM_SCENE.src).toBe('/images/sala-demo.jpg');
    expect(ROOM_SCENE.alt).toBe('');
    expect(ROOM_SCENE.sofaWidthCm).toBe(210);
  });
});
