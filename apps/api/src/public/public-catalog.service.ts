import { Injectable } from '@nestjs/common';
import type { ArtworkStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';

const NAME_SELECT = { slug: true, nameEs: true, nameEn: true } as const;

const LIST_SELECT = {
  slug: true,
  title: true,
  status: true,
  year: true,
  isDemo: true,
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: { where: { isPrimary: true }, select: { cloudinaryPublicId: true }, take: 1 },
} satisfies Prisma.ArtworkSelect;

const DETAIL_SELECT = {
  slug: true,
  title: true,
  status: true,
  year: true,
  isDemo: true,
  widthCm: true,
  heightCm: true,
  referencePriceCop: true,
  descriptionEs: true,
  descriptionEn: true,
  publishedAt: true,
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: {
    orderBy: { position: 'asc' },
    select: { cloudinaryPublicId: true, position: true, isPrimary: true },
  },
} satisfies Prisma.ArtworkSelect;

// Cuenta solo obras publicadas
const PUBLISHED_COUNT = {
  _count: { select: { artworks: { where: { publishedAt: { not: null } } } } },
} as const;

export type ListArtworksParams = {
  page: number;
  pageSize: number;
  seriesSlug?: string;
  techniqueSlug?: string;
  status?: ArtworkStatus;
};

// Única puerta de lectura pública de obras: nada sin publicar sale de aquí
@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private publishedWhere(extra: Prisma.ArtworkWhereInput = {}): Prisma.ArtworkWhereInput {
    return { AND: [{ publishedAt: { not: null } }, extra] };
  }

  async listArtworks(params: ListArtworksParams) {
    const { page, pageSize, seriesSlug, techniqueSlug, status } = params;
    const filter: Prisma.ArtworkWhereInput = {
      ...(seriesSlug !== undefined && { series: { slug: seriesSlug } }),
      ...(techniqueSlug !== undefined && { technique: { slug: techniqueSlug } }),
      ...(status !== undefined && { status }),
    };

    const rows = await this.prisma.artwork.findMany({
      where: this.publishedWhere(filter),
      select: LIST_SELECT,
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await this.prisma.artwork.count({ where: this.publishedWhere(filter) });

    return {
      items: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        status: row.status,
        year: row.year,
        isDemo: row.isDemo,
        technique: row.technique,
        series: row.series,
        primaryImagePublicId: row.images[0]?.cloudinaryPublicId ?? null,
      })),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getArtworkBySlug(slug: string) {
    const row = await this.prisma.artwork.findFirst({
      where: this.publishedWhere({ slug }),
      select: DETAIL_SELECT,
    });
    if (!row) return null;

    return {
      slug: row.slug,
      title: row.title,
      status: row.status,
      year: row.year,
      isDemo: row.isDemo,
      widthCm: row.widthCm ? row.widthCm.toNumber() : null,
      heightCm: row.heightCm ? row.heightCm.toNumber() : null,
      referencePriceCop: row.referencePriceCop,
      descriptionEs: row.descriptionEs,
      descriptionEn: row.descriptionEn,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      technique: row.technique,
      series: row.series,
      images: row.images.map((image) => ({
        cloudinaryPublicId: image.cloudinaryPublicId,
        position: image.position,
        isPrimary: image.isPrimary,
      })),
    };
  }

  async listTechniques() {
    const rows = await this.prisma.technique.findMany({
      orderBy: { nameEs: 'asc' },
      select: { ...NAME_SELECT, ...PUBLISHED_COUNT },
    });
    return rows
      .map((row) => ({
        slug: row.slug,
        nameEs: row.nameEs,
        nameEn: row.nameEn,
        artworkCount: row._count.artworks,
      }))
      .filter((row) => row.artworkCount > 0);
  }

  async listSeries() {
    const rows = await this.prisma.series.findMany({
      orderBy: { nameEs: 'asc' },
      select: { ...NAME_SELECT, ...PUBLISHED_COUNT },
    });
    return rows
      .map((row) => ({
        slug: row.slug,
        nameEs: row.nameEs,
        nameEn: row.nameEn,
        artworkCount: row._count.artworks,
      }))
      .filter((row) => row.artworkCount > 0);
  }

  async listPublishedSlugs() {
    const rows = await this.prisma.artwork.findMany({
      where: this.publishedWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
    return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
  }
}
