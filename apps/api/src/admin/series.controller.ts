import {
  Body,
  ConflictException,
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
import { PrismaService } from '../prisma.service.js';
import {
  asObject,
  invalid,
  isPrismaError,
  parseNameEn,
  parseNameEs,
  parseUuid,
} from './validation.js';

const SERIES_SELECT = {
  id: true,
  slug: true,
  nameEs: true,
  nameEn: true,
  _count: { select: { artworks: true } },
} as const;

type SeriesRow = {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string | null;
  _count: { artworks: number };
};

function toDto(row: SeriesRow) {
  return {
    id: row.id,
    slug: row.slug,
    nameEs: row.nameEs,
    nameEn: row.nameEn,
    artworkCount: row._count.artworks,
  };
}

@Controller('admin/series')
@UseGuards(AdminGuard)
export class SeriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.series.findMany({
      orderBy: { nameEs: 'asc' },
      select: SERIES_SELECT,
    });
    return rows.map(toDto);
  }

  @Post()
  async create(@Body() body: unknown) {
    const data = asObject(body);
    const nameEs = parseNameEs(data.nameEs);
    const nameEn = data.nameEn === undefined ? null : parseNameEn(data.nameEn);
    const slug = slugify(nameEs);
    if (slug.length === 0) invalid();

    const existing = await this.prisma.series.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('A series with that name already exists');

    try {
      const row = await this.prisma.series.create({
        data: { slug, nameEs, nameEn },
        select: SERIES_SELECT,
      });
      return toDto(row);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('A series with that name already exists');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id') rawId: string, @Body() body: unknown) {
    const id = parseUuid(rawId, 'Series not found');
    const data = asObject(body);
    if (data.nameEs === undefined && data.nameEn === undefined) invalid();

    // El slug nunca se modifica
    const changes: { nameEs?: string; nameEn?: string | null } = {};
    if (data.nameEs !== undefined) changes.nameEs = parseNameEs(data.nameEs);
    if (data.nameEn !== undefined) changes.nameEn = parseNameEn(data.nameEn);

    try {
      const row = await this.prisma.series.update({
        where: { id },
        data: changes,
        select: SERIES_SELECT,
      });
      return toDto(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Series not found');
      throw error;
    }
  }

  // Las obras de la serie no se borran: el esquema las deja sin serie (SetNull)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') rawId: string): Promise<void> {
    const id = parseUuid(rawId, 'Series not found');
    const row = await this.prisma.series.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Series not found');

    try {
      await this.prisma.series.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Series not found');
      throw error;
    }
  }
}
