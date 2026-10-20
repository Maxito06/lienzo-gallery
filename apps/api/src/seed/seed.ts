import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  uploadImageFromUrl,
  type CloudinaryConfig,
} from './cloudinary-upload.js';
import { demoArtworks, imageUrl } from './demo-artworks.js';

const techniques = [
  { slug: 'oleo-sobre-lienzo', nameEs: 'Óleo sobre lienzo', nameEn: 'Oil on canvas' },
  { slug: 'oleo-sobre-tabla', nameEs: 'Óleo sobre tabla', nameEn: 'Oil on board' },
  { slug: 'acuarela', nameEs: 'Acuarela', nameEn: 'Watercolor' },
  { slug: 'grabado', nameEs: 'Grabado', nameEn: 'Print' },
  { slug: 'dibujo', nameEs: 'Dibujo', nameEn: 'Drawing' },
];

const seriesList = [
  { slug: 'paisajes', nameEs: 'Paisajes', nameEn: 'Landscapes' },
  { slug: 'retratos', nameEs: 'Retratos', nameEn: 'Portraits' },
  { slug: 'naturalezas-muertas', nameEs: 'Naturalezas muertas', nameEn: 'Still life' },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno: ${name}`);
  }
  return value;
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const adminEmail = requireEnv('ADMIN_EMAIL');
  const adminPassword = requireEnv('ADMIN_PASSWORD');
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }
  const cloudinary: CloudinaryConfig = {
    cloudName: requireEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: requireEnv('CLOUDINARY_API_KEY'),
    apiSecret: requireEnv('CLOUDINARY_API_SECRET'),
    uploadPreset: requireEnv('CLOUDINARY_UPLOAD_PRESET'),
  };

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
    });
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
      create: { email: adminEmail, passwordHash },
    });

    for (const technique of techniques) {
      await prisma.technique.upsert({
        where: { slug: technique.slug },
        update: { nameEs: technique.nameEs, nameEn: technique.nameEn },
        create: technique,
      });
    }

    for (const series of seriesList) {
      await prisma.series.upsert({
        where: { slug: series.slug },
        update: { nameEs: series.nameEs, nameEn: series.nameEn },
        create: series,
      });
    }

    let newPhotos = 0;
    let existingPhotos = 0;
    for (const demo of demoArtworks) {
      const technique = await prisma.technique.findUniqueOrThrow({
        where: { slug: demo.techniqueSlug },
      });
      const series = demo.seriesSlug
        ? await prisma.series.findUniqueOrThrow({
            where: { slug: demo.seriesSlug },
          })
        : null;

      const data = {
        title: demo.title,
        year: demo.year,
        widthCm: demo.widthCm,
        heightCm: demo.heightCm,
        status: demo.status,
        referencePriceCop: demo.referencePriceCop,
        descriptionEs: demo.descriptionEs,
        descriptionEn: demo.descriptionEn,
        techniqueId: technique.id,
        seriesId: series ? series.id : null,
        isDemo: true,
      };

      const artwork = await prisma.artwork.upsert({
        where: { slug: demo.slug },
        update: data,
        create: {
          slug: demo.slug,
          ...data,
          publishedAt: demo.published ? new Date() : null,
        },
      });

      const photoCount = await prisma.artworkImage.count({
        where: { artworkId: artwork.id },
      });
      if (photoCount > 0) {
        existingPhotos += 1;
        continue;
      }

      const publicId = await uploadImageFromUrl(
        imageUrl(demo.imageId),
        cloudinary,
      );
      await prisma.artworkImage.create({
        data: {
          artworkId: artwork.id,
          cloudinaryPublicId: publicId,
          position: 1,
          isPrimary: true,
        },
      });
      newPhotos += 1;
      console.log(`Foto subida: ${demo.slug}`);
    }

    console.log(
      `Seed listo: 1 admin, ${techniques.length} técnicas, ${seriesList.length} series, ${demoArtworks.length} obras de demostración (${newPhotos} fotos nuevas, ${existingPhotos} ya tenían foto).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
