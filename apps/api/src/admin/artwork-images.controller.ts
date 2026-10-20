import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { CloudinaryNotConfiguredError, CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma.service.js';
import { DETAIL_INCLUDE, toDetailDto } from './artwork-dto.js';
import { asObject, invalid, isPrismaError, parseUuid } from './validation.js';

export const MAX_IMAGES_PER_ARTWORK = 8;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const ALLOWED_IMAGE_FORMATS = ['jpg', 'png', 'webp'];

const PUBLIC_ID_REGEX = /^lienzo\/artworks\/[A-Za-z0-9_-]{1,100}$/;

@Controller('admin/artworks/:artworkId/images')
@UseGuards(AdminGuard)
export class ArtworkImagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // Autorización corta firmada para que el navegador suba directo a Cloudinary
  @Post('sign')
  @HttpCode(200)
  async sign(@Param('artworkId') rawId: string) {
    const artworkId = parseUuid(rawId, 'Artwork not found');
    await this.assertCanAddImage(artworkId);
    return this.fromStorage(() => this.cloudinary.signUpload());
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
      if (isPrismaError(error, 'P2002')) throw new ConflictException('Image already registered');
      throw error;
    }

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
