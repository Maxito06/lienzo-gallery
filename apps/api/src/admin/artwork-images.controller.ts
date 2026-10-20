import { randomBytes } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { CloudinaryNotConfiguredError, CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma.service.js';
import { DETAIL_INCLUDE, toDetailDto } from './artwork-dto.js';
import { UUID_REGEX, asObject, invalid, isPrismaError, parseUuid } from './validation.js';

export const MAX_IMAGES_PER_ARTWORK = 8;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const ALLOWED_IMAGE_FORMATS = ['jpg', 'png', 'webp'];

const PUBLIC_ID_PREFIX = 'lienzo/artworks/';
export const PUBLIC_ID_REGEX = /^lienzo\/artworks\/[A-Za-z0-9_-]{1,100}$/;

@Controller('admin/artworks/:artworkId/images')
@UseGuards(AdminGuard)
export class ArtworkImagesController {
  private readonly logger = new Logger(ArtworkImagesController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // Autorización corta firmada para que el navegador suba directo a Cloudinary.
  // El public_id lo genera el servidor y va dentro de la firma.
  @Post('sign')
  @HttpCode(200)
  async sign(@Param('artworkId') rawId: string) {
    const artworkId = parseUuid(rawId, 'Artwork not found');
    await this.assertCanAddImage(artworkId);
    const publicId = `${PUBLIC_ID_PREFIX}${randomBytes(16).toString('base64url')}`;
    return this.fromStorage(() => this.cloudinary.signUpload(publicId));
  }

  // Registra una foto ya subida, verificándola contra Cloudinary antes de guardarla
  @Post()
  async register(@Param('artworkId') rawId: string, @Body() body: unknown) {
    const artworkId = parseUuid(rawId, 'Artwork not found');
    const data = asObject(body);
    const publicId = data.publicId;
    if (typeof publicId !== 'string' || !PUBLIC_ID_REGEX.test(publicId)) invalid();

    const existingCount = await this.assertCanAddImage(artworkId);

    const duplicate = await this.prisma.artworkImage.findFirst({
      where: { cloudinaryPublicId: publicId },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Image already registered');

    const resource = await this.fromStorage(() => this.cloudinary.getResource(publicId));
    if (!resource) throw new BadRequestException('Image not found in storage');

    const rejection = this.checkResource(resource);
    if (rejection) {
      // Limpieza best-effort del archivo rechazado
      try {
        await this.cloudinary.deleteResources([publicId]);
      } catch {
        // se ignora: el archivo huérfano se limpia más adelante
      }
      throw new UnprocessableEntityException(rejection);
    }

    const last = await this.prisma.artworkImage.aggregate({
      where: { artworkId },
      _max: { position: true },
    });
    try {
      await this.prisma.artworkImage.create({
        data: {
          artworkId,
          cloudinaryPublicId: publicId,
          position: (last._max.position ?? 0) + 1,
          isPrimary: existingCount === 0,
        },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        // Distingue un duplicado de public id de una colisión de position por carrera
        const existing = await this.prisma.artworkImage.findFirst({
          where: { cloudinaryPublicId: publicId },
          select: { id: true },
        });
        if (existing) throw new ConflictException('Image already registered');
        throw new ConflictException('Concurrent change, please retry');
      }
      throw error;
    }

    const row = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Artwork not found');
    return toDetailDto(row);
  }

  // Marca una imagen como principal; siempre queda exactamente una
  @Post(':imageId/primary')
  @HttpCode(200)
  async setPrimary(@Param('artworkId') rawArtworkId: string, @Param('imageId') rawImageId: string) {
    const artworkId = parseUuid(rawArtworkId, 'Artwork not found');
    const imageId = parseUuid(rawImageId, 'Image not found');
    await this.assertArtworkExists(artworkId);

    const image = await this.prisma.artworkImage.findFirst({
      where: { id: imageId, artworkId },
      select: { isPrimary: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    if (!image.isPrimary) {
      await this.prisma.$transaction(async (tx) => {
        await tx.artworkImage.updateMany({
          where: { artworkId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.artworkImage.update({ where: { id: imageId }, data: { isPrimary: true } });
      });
    }
    return this.detail(artworkId);
  }

  // Reordena las imágenes; el cuerpo debe traer exactamente los ids de la obra
  @Put('order')
  @HttpCode(200)
  async reorder(@Param('artworkId') rawId: string, @Body() body: unknown) {
    const artworkId = parseUuid(rawId, 'Artwork not found');
    const data = asObject(body);
    const imageIds = data.imageIds;
    if (
      !Array.isArray(imageIds) ||
      imageIds.length < 1 ||
      imageIds.length > MAX_IMAGES_PER_ARTWORK ||
      imageIds.some((id) => typeof id !== 'string' || !UUID_REGEX.test(id)) ||
      new Set(imageIds).size !== imageIds.length
    ) {
      return invalid();
    }
    const requested = imageIds as string[];

    await this.assertArtworkExists(artworkId);
    const current = await this.prisma.artworkImage.findMany({
      where: { artworkId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((image) => image.id));
    if (currentIds.size !== requested.length || requested.some((id) => !currentIds.has(id))) {
      invalid();
    }

    await this.prisma.$transaction(async (tx) => {
      // Se desplaza primero para no chocar con la restricción única (artworkId, position)
      await tx.artworkImage.updateMany({
        where: { artworkId },
        data: { position: { increment: 1000 } },
      });
      for (const [index, id] of requested.entries()) {
        await tx.artworkImage.update({ where: { id }, data: { position: index + 1 } });
      }
    });
    return this.detail(artworkId);
  }

  // Elimina una imagen, compacta posiciones y borra el archivo en mejor esfuerzo
  @Delete(':imageId')
  @HttpCode(200)
  async remove(@Param('artworkId') rawArtworkId: string, @Param('imageId') rawImageId: string) {
    const artworkId = parseUuid(rawArtworkId, 'Artwork not found');
    const imageId = parseUuid(rawImageId, 'Image not found');

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      select: {
        publishedAt: true,
        images: {
          orderBy: { position: 'asc' },
          select: { id: true, cloudinaryPublicId: true, isPrimary: true, position: true },
        },
      },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');

    const image = artwork.images.find((item) => item.id === imageId);
    if (!image) throw new NotFoundException('Image not found');
    if (artwork.images.length === 1 && artwork.publishedAt !== null) {
      throw new ConflictException('Cannot delete the last image of a published artwork');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.artworkImage.delete({ where: { id: imageId } });
      const remaining = artwork.images.filter((item) => item.id !== imageId);

      if (image.isPrimary && remaining[0]) {
        await tx.artworkImage.update({ where: { id: remaining[0].id }, data: { isPrimary: true } });
      }
      // Las posiciones solo bajan, así que no chocan con la restricción única
      for (const [index, item] of remaining.entries()) {
        if (item.position !== index + 1) {
          await tx.artworkImage.update({ where: { id: item.id }, data: { position: index + 1 } });
        }
      }
    });

    try {
      await this.cloudinary.deleteResources([image.cloudinaryPublicId]);
    } catch {
      // El archivo queda huérfano y se limpiará más adelante
      this.logger.warn(`Could not delete file from storage: ${image.cloudinaryPublicId}`);
    }
    return this.detail(artworkId);
  }

  private async assertArtworkExists(artworkId: string): Promise<void> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      select: { id: true },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
  }

  private async detail(artworkId: string) {
    const row = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Artwork not found');
    return toDetailDto(row);
  }

  // Comprueba que la obra existe y que aún cabe otra imagen; devuelve cuántas tiene
  private async assertCanAddImage(artworkId: string): Promise<number> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      select: { _count: { select: { images: true } } },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
    if (artwork._count.images >= MAX_IMAGES_PER_ARTWORK) {
      throw new ConflictException('Image limit reached');
    }
    return artwork._count.images;
  }

  private checkResource(resource: {
    format: string;
    width: number;
    height: number;
    bytes: number;
  }): string | null {
    if (!ALLOWED_IMAGE_FORMATS.includes(resource.format.toLowerCase())) {
      return 'Image rejected: unsupported format';
    }
    if (resource.bytes > MAX_IMAGE_BYTES) return 'Image rejected: file too large';
    if (!(resource.width >= 1) || !(resource.height >= 1)) {
      return 'Image rejected: invalid dimensions';
    }
    if (resource.width * resource.height > MAX_IMAGE_PIXELS) {
      return 'Image rejected: resolution too large';
    }
    return null;
  }

  // Traduce los errores del almacén de imágenes a respuestas HTTP
  private async fromStorage<T>(call: () => T | Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof CloudinaryNotConfiguredError) {
        throw new ServiceUnavailableException('Image storage is not configured');
      }
      throw new BadGatewayException('Image storage is unavailable');
    }
  }
}
