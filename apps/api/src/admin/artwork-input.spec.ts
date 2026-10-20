import { BadRequestException } from '@nestjs/common';
import { parseArtworkInput } from './artwork-input.js';

const TECHNIQUE_ID = '3f2b1c9e-8a4d-4e6f-9b1a-2c3d4e5f6a7b';
const base = { title: 'Sunset', techniqueId: TECHNIQUE_ID };

const create = (extra: Record<string, unknown> = {}) =>
  parseArtworkInput({ ...base, ...extra }, 'create');
const update = (body: unknown) => parseArtworkInput(body, 'update');

describe('parseArtworkInput', () => {
  it('accepts a minimal create and returns only title and techniqueId', () => {
    expect(create()).toEqual({ title: 'Sunset', techniqueId: TECHNIQUE_ID });
  });

  it('rejects a create without title or techniqueId', () => {
    expect(() => parseArtworkInput({ techniqueId: TECHNIQUE_ID }, 'create')).toThrow(BadRequestException);
    expect(() => parseArtworkInput({ title: 'Sunset' }, 'create')).toThrow(BadRequestException);
  });

  it('ignores publishedAt, isDemo, slug and id', () => {
    const result = create({
      publishedAt: '2026-01-01T00:00:00Z',
      isDemo: true,
      slug: 'hacked',
      id: TECHNIQUE_ID,
    });
    expect(result).toEqual({ title: 'Sunset', techniqueId: TECHNIQUE_ID });
  });

  it('rejects empty, blank and too long titles', () => {
    expect(() => create({ title: '' })).toThrow(BadRequestException);
    expect(() => create({ title: '   ' })).toThrow(BadRequestException);
    expect(() => create({ title: 'a'.repeat(121) })).toThrow(BadRequestException);
    expect(create({ title: 'a'.repeat(120) }).title).toHaveLength(120);
  });

  it('validates year as an integer between 1000 and 2100 or null', () => {
    for (const year of [999, 2101, 2020.5, '2020']) {
      expect(() => create({ year })).toThrow(BadRequestException);
    }
    expect(create({ year: 1000 }).year).toBe(1000);
    expect(create({ year: 2100 }).year).toBe(2100);
    expect(create({ year: null }).year).toBeNull();
  });

  it('validates dimensions as positive numbers with at most one decimal', () => {
    for (const widthCm of [0, -1, 12.34, 'abc', NaN, 10000]) {
      expect(() => create({ widthCm })).toThrow(BadRequestException);
    }
    expect(create({ widthCm: 30.5 }).widthCm).toBe(30.5);
    expect(create({ heightCm: 0.1 }).heightCm).toBe(0.1);
    expect(create({ heightCm: null }).heightCm).toBeNull();
  });

  it('validates referencePriceCop as an integer between 1 and 2000000000', () => {
    for (const referencePriceCop of [0, 1.5, 2_000_000_001]) {
      expect(() => create({ referencePriceCop })).toThrow(BadRequestException);
    }
    expect(create({ referencePriceCop: 1 }).referencePriceCop).toBe(1);
    expect(create({ referencePriceCop: 2_000_000_000 }).referencePriceCop).toBe(2_000_000_000);
  });

  it('validates status against the enum', () => {
    expect(() => create({ status: 'GONE' })).toThrow(BadRequestException);
    expect(create({ status: 'SOLD' }).status).toBe('SOLD');
  });

  it('validates descriptions and turns blank ones into null', () => {
    expect(() => create({ descriptionEs: 'a'.repeat(2001) })).toThrow(BadRequestException);
    expect(create({ descriptionEs: '   ' }).descriptionEs).toBeNull();
    expect(create({ descriptionEn: null }).descriptionEn).toBeNull();
  });

  it('validates techniqueId and seriesId as UUIDs', () => {
    expect(() => create({ techniqueId: 'abc' })).toThrow(BadRequestException);
    expect(() => create({ seriesId: 'abc' })).toThrow(BadRequestException);
    expect(create({ seriesId: null }).seriesId).toBeNull();
  });

  it('rejects an update with an empty body or only unknown keys', () => {
    expect(() => update({})).toThrow(BadRequestException);
    expect(() => update({ slug: 'x', publishedAt: null })).toThrow(BadRequestException);
  });

  it('accepts an update with only seriesId null', () => {
    expect(update({ seriesId: null })).toEqual({ seriesId: null });
  });

  it('rejects arrays and null as body', () => {
    expect(() => parseArtworkInput([], 'create')).toThrow(BadRequestException);
    expect(() => parseArtworkInput(null, 'update')).toThrow(BadRequestException);
  });
});
