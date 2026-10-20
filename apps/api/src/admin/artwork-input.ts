import { ArtworkStatus } from '../generated/prisma/enums.js';
import { UUID_REGEX, asObject, invalid } from './validation.js';

export type ArtworkInput = {
  title?: string;
  techniqueId?: string;
  seriesId?: string | null;
  year?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  status?: ArtworkStatus;
  referencePriceCop?: number | null;
  descriptionEs?: string | null;
  descriptionEn?: string | null;
};

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const STATUS_VALUES: string[] = Object.values(ArtworkStatus);

function parseTitle(value: unknown): string {
  if (typeof value !== 'string') return invalid();
  const title = value.trim();
  if (title.length < 1 || title.length > MAX_TITLE_LENGTH) return invalid();
  return title;
}

function parseUuidValue(value: unknown): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) return invalid();
  return value;
}

function parseIntegerInRange(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return invalid();
  }
  return value;
}

// Número positivo de máximo 9999.9 con un solo decimal
function parseDimension(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 9999.9) {
    return invalid();
  }
  if (Math.abs(value * 10 - Math.round(value * 10)) >= 1e-9) return invalid();
  return value;
}

function parseDescription(value: unknown): string | null {
  if (typeof value !== 'string') return invalid();
  const text = value.trim();
  if (text.length > MAX_DESCRIPTION_LENGTH) return invalid();
  return text.length === 0 ? null : text;
}

function parseStatus(value: unknown): ArtworkStatus {
  if (typeof value !== 'string' || !STATUS_VALUES.includes(value)) return invalid();
  return value as ArtworkStatus;
}

// Valida el cuerpo; los campos ausentes no aparecen y las claves desconocidas se ignoran
export function parseArtworkInput(body: unknown, mode: 'create' | 'update'): ArtworkInput {
  const data = asObject(body);
  const result: ArtworkInput = {};

  if (data.title !== undefined) result.title = parseTitle(data.title);
  if (data.techniqueId !== undefined) result.techniqueId = parseUuidValue(data.techniqueId);
  if (data.seriesId !== undefined) {
    result.seriesId = data.seriesId === null ? null : parseUuidValue(data.seriesId);
  }
  if (data.year !== undefined) {
    result.year = data.year === null ? null : parseIntegerInRange(data.year, 1000, 2100);
  }
  if (data.widthCm !== undefined) {
    result.widthCm = data.widthCm === null ? null : parseDimension(data.widthCm);
  }
  if (data.heightCm !== undefined) {
    result.heightCm = data.heightCm === null ? null : parseDimension(data.heightCm);
  }
  if (data.status !== undefined) result.status = parseStatus(data.status);
  if (data.referencePriceCop !== undefined) {
    result.referencePriceCop =
      data.referencePriceCop === null
        ? null
        : parseIntegerInRange(data.referencePriceCop, 1, 2_000_000_000);
  }
  if (data.descriptionEs !== undefined) {
    result.descriptionEs = data.descriptionEs === null ? null : parseDescription(data.descriptionEs);
  }
  if (data.descriptionEn !== undefined) {
    result.descriptionEn = data.descriptionEn === null ? null : parseDescription(data.descriptionEn);
  }

  if (mode === 'create') {
    if (result.title === undefined || result.techniqueId === undefined) invalid();
  } else if (Object.keys(result).length === 0) {
    invalid();
  }
  return result;
}
