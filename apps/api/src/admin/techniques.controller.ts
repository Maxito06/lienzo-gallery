import {
  BadRequestException,
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
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 80;
const TECHNIQUE_SELECT = {
  id: true,
  slug: true,
  nameEs: true,
  nameEn: true,
  _count: { select: { artworks: true } },
} as const;

type TechniqueRow = {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string | null;
  _count: { artworks: number };
};

function toDto(row: TechniqueRow) {
  return {
    id: row.id,
    slug: row.slug,
    nameEs: row.nameEs,
    nameEn: row.nameEn,
    artworkCount: row._count.artworks,
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function invalid(): never {
  throw new BadRequestException('Invalid request');
}

function parseId(id: string): string {
  if (!UUID_REGEX.test(id)) throw new NotFoundException('Technique not found');
  return id;
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) invalid();
  return body as Record<string, unknown>;
}

function parseNameEs(value: unknown): string {
  if (typeof value !== 'string') return invalid();
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) return invalid();
  return name;
}

// Una cadena vacía tras recortar se guarda como null
function parseNameEn(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return invalid();
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) return invalid();
  return name.length === 0 ? null : name;
}

@Controller('admin/techniques')
@UseGuards(AdminGuard)
export class TechniquesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.technique.findMany({
      orderBy: { nameEs: 'asc' },
      select: TECHNIQUE_SELECT,
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

    const existing = await this.prisma.technique.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('A technique with that name already exists');

    try {
      const row = await this.prisma.technique.create({
        data: { slug, nameEs, nameEn },
        select: TECHNIQUE_SELECT,
      });
      return toDto(row);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('A technique with that name already exists');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(@Param('id') rawId: string, @Body() body: unknown) {
    const id = parseId(rawId);
    const data = asObject(body);
    if (data.nameEs === undefined && data.nameEn === undefined) invalid();

    // El slug nunca se modifica
    const changes: { nameEs?: string; nameEn?: string | null } = {};
    if (data.nameEs !== undefined) changes.nameEs = parseNameEs(data.nameEs);
    if (data.nameEn !== undefined) changes.nameEn = parseNameEn(data.nameEn);

    try {
      const row = await this.prisma.technique.update({
        where: { id },
        data: changes,
        select: TECHNIQUE_SELECT,
      });
      return toDto(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Technique not found');
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') rawId: string): Promise<void> {
    const id = parseId(rawId);
    const row = await this.prisma.technique.findUnique({ where: { id }, select: TECHNIQUE_SELECT });
    if (!row) throw new NotFoundException('Technique not found');
    if (row._count.artworks > 0) throw new ConflictException('Technique is in use');

    try {
      await this.prisma.technique.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) throw new ConflictException('Technique is in use');
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Technique not found');
      throw error;
    }
  }
}
