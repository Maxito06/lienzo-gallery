import type { Prisma } from '../generated/prisma/client.js';

export const NAME_SELECT = { id: true, slug: true, nameEs: true, nameEn: true } as const;

export const LIST_INCLUDE = {
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: { where: { isPrimary: true }, select: { cloudinaryPublicId: true }, take: 1 },
  _count: { select: { images: true } },
} satisfies Prisma.ArtworkInclude;

export const DETAIL_INCLUDE = {
  technique: { select: NAME_SELECT },
  series: { select: NAME_SELECT },
  images: { orderBy: { position: 'asc' } },
  _count: { select: { images: true } },
} satisfies Prisma.ArtworkInclude;

export type ListRow = Prisma.ArtworkGetPayload<{ include: typeof LIST_INCLUDE }>;
export type DetailRow = Prisma.ArtworkGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export function summary(row: ListRow | DetailRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    isPublished: row.publishedAt !== null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    isDemo: row.isDemo,
    year: row.year,
    widthCm: row.widthCm ? row.widthCm.toNumber() : null,
    heightCm: row.heightCm ? row.heightCm.toNumber() : null,
    referencePriceCop: row.referencePriceCop,
    technique: row.technique,
    series: row.series,
    imageCount: row._count.images,
  };
}

export function toListDto(row: ListRow) {
  return { ...summary(row), primaryImagePublicId: row.images[0]?.cloudinaryPublicId ?? null };
}

export function toDetailDto(row: DetailRow) {
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
