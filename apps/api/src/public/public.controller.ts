import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ArtworkStatus } from '../generated/prisma/enums.js';
import { PublicCatalogService } from './public-catalog.service.js';

const SLUG_REGEX = /^[a-z0-9-]{1,160}$/;
const DIGITS_REGEX = /^\d+$/;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;
const MAX_PAGE = 100_000;
const STATUS_VALUES: string[] = Object.values(ArtworkStatus);

function invalid(): never {
  throw new BadRequestException('Invalid request');
}

// Un parámetro repetido llega como arreglo y se rechaza
function single(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalid();
  return value;
}

function parseNumber(value: unknown, fallback: number): number {
  const text = single(value);
  if (text === undefined) return fallback;
  if (!DIGITS_REGEX.test(text)) return invalid();
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) return invalid();
  return parsed;
}

function parseSlug(value: unknown): string | undefined {
  const text = single(value);
  if (text === undefined) return undefined;
  if (!SLUG_REGEX.test(text)) return invalid();
  return text;
}

@Controller('public')
export class PublicController {
  constructor(private readonly catalog: PublicCatalogService) {}

  @Get('artworks')
  listArtworks(@Query() query: Record<string, unknown>) {
    const page = parseNumber(query.page, 1);
    const pageSize = parseNumber(query.pageSize, DEFAULT_PAGE_SIZE);
    if (page < 1 || page > MAX_PAGE || pageSize < 1 || pageSize > MAX_PAGE_SIZE) invalid();

    const status = single(query.status);
    if (status !== undefined && !STATUS_VALUES.includes(status)) invalid();

    return this.catalog.listArtworks({
      page,
      pageSize,
      seriesSlug: parseSlug(query.series),
      techniqueSlug: parseSlug(query.technique),
      status: status as ArtworkStatus | undefined,
    });
  }

  @Get('artworks/:slug')
  async getArtwork(@Param('slug') slug: string) {
    // Mismo mensaje si es malformado, inexistente o no publicada
    if (!SLUG_REGEX.test(slug)) throw new NotFoundException('Artwork not found');
    const artwork = await this.catalog.getArtworkBySlug(slug);
    if (!artwork) throw new NotFoundException('Artwork not found');
    return artwork;
  }

  @Get('techniques')
  listTechniques() {
    return this.catalog.listTechniques();
  }

  @Get('series')
  listSeries() {
    return this.catalog.listSeries();
  }
}
