import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { slugify } from '../common/slugify.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { type ArtworkInput, parseArtworkInput } from './artwork-input.js';
import { isPrismaError, parseUuid } from './validation.js';

const NAME_SELECT = { id: true, slug: true, nameEs: true, nameEn: true } as const;

const LIST_INCLUDE = {
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: { where: { isPrimary: true }, select: { cloudinaryPublicId: true }, take: 1 },
  _count: { select: { images: true } },
} satisfies Prisma.ArtworkInclude;

const DETAIL_INCLUDE = {
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: { orderBy: { position: 'asc' } },
  _count: { select: { images: true } },
} satisfies Prisma.ArtworkInclude;

type ListRow = Prisma.ArtworkGetPayload<{ include: typeof LIST_INCLUDE }>;
type DetailRow = Prisma.ArtworkGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const MAX_SLUG_ATTEMPTS = 5;

function summary(row: ListRow | DetailRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    isPublished: row.publishedAt !== null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    year: row.year,
    widthCm: row.widthCm ? row.widthCm.toNumber() : null,
    heightCm: row.heightCm ? row.heightCm.toNumber() : null,
    referencePriceCop: row.referencePriceCop,
    technique: row.technique,
    series: row.series,
    imageCount: row._count.images,
  };
}

function toListDto(row: ListRow) {
  return { ...summary(row), primaryImagePublicId: row.images[0]?.cloudinaryPublicId ?? null };
}

function toDetailDto(row: DetailRow) {
  return {
    ...summary(row),
    primaryImagePublicId: row.images.find((image) => image.isPrimary)?.cloudinaryPublicId ?? null,
    descriptionEs: row.descriptionEs,
    descriptionEn: row.descriptionEn,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    images: row.images.map((image) => ({
      id: image.id,
      cloudinaryPublicId: image.cloudinaryPublicId,
      position: image.position,
      isPrimary: image.isPrimary,
    })),
  };
}

@Controller('admin/artworks')
@UseGuards(AdminGuard)
export class ArtworksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.artwork.findMany({
      orderBy: { createdAt: 'desc' },
      include: LIST_INCLUDE,
    });
    return rows.map(toListDto);
  }

  @Get(':id')
  async detail(@Param('id') rawId: string) {
    const id = parseUuid(rawId, 'Artwork not found');
    const row = await this.prisma.artwork.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException('Artwork not found');
    return toDetailDto(row);
  }

  @Post()
  async create(@Body() body: unknown) {
    const input = parseArtworkInput(body, 'create');
    await this.assertRelationsExist(input);
    const { title, techniqueId, ...optional } = input as ArtworkInput & {
      title: string;
      techniqueId: string;
    };

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = await this.generateUniqueSlug(title);
      try {
        const row = await this.prisma.artwork.create({
          data: { ...optional, title, techniqueId, slug },
          include: DETAIL_INCLUDE,
        });
        return toDetailDto(row);
      } catch (error) {
        if (isPrismaError(error, 'P2003')) {
          throw new BadRequestException('Unknown technique or series');
        }
        // Colisión de slug por carrera: se reintenta con otro
        if (isPrismaError(error, 'P2002') && attempt < MAX_SLUG_ATTEMPTS) continue;
        throw error;
      }
    }
    throw new Error('Could not generate a unique slug');
  }

  @Patch(':id')
  async update(@Param('id') rawId: string, @Body() body: unknown) {
    const id = parseUuid(rawId, 'Artwork not found');
    const input = parseArtworkInput(body, 'update');
    await this.assertRelationsExist(input);

    // El slug y publishedAt no se modifican aquí
    try {
      const row = await this.prisma.artwork.update({
        where: { id },
        data: input,
        include: DETAIL_INCLUDE,
      });
      return toDetailDto(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Artwork not found');
      if (isPrismaError(error, 'P2003')) {
        throw new BadRequestException('Unknown technique or series');
      }
      throw error;
    }
  }

  // No borra los archivos en Cloudinary; se resuelve en HU-09
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') rawId: string): Promise<void> {
    const id = parseUuid(rawId, 'Artwork not found');
    try {
      await this.prisma.artwork.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Artwork not found');
      throw error;
    }
  }

  private async assertRelationsExist(input: ArtworkInput): Promise<void> {
    if (input.techniqueId !== undefined) {
      const technique = await this.prisma.technique.findUnique({
        where: { id: input.techniqueId },
        select: { id: true },
      });
      if (!technique) throw new BadRequestException('Unknown technique');
    }
    if (input.seriesId) {
      const series = await this.prisma.series.findUnique({
        where: { id: input.seriesId },
        select: { id: true },
      });
      if (!series) throw new BadRequestException('Unknown series');
    }
  }

  // Primer slug libre entre base, base-2, base-3...
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'artwork';
    const rows = await this.prisma.artwork.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
}
