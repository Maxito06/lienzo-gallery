import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';

const techniques = [
  { slug: 'oleo-sobre-lienzo', nameEs: 'Óleo sobre lienzo', nameEn: 'Oil on canvas' },
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

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
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

    console.log(
      `Seed A listo: 1 admin, ${techniques.length} técnicas, ${seriesList.length} series.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
