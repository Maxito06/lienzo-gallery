import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';

const CSRF = 'lienzo-web';
const URL = '/admin/artworks';

describe('Artwork publishing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;
  let techniqueId: string;
  const artworkIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await createAdminSession(app);
    cookie = admin.cookie;
    cleanupAdmin = admin.cleanup;

    const technique = await prisma.technique.create({
      data: { slug: `technique-${randomUUID()}`, nameEs: `Technique ${randomUUID()}` },
    });
    techniqueId = technique.id;
  });

  afterAll(async () => {
    await prisma.artworkImage.deleteMany({ where: { artworkId: { in: artworkIds } } });
    await prisma.artwork.deleteMany({ where: { id: { in: artworkIds } } });
    await prisma.technique.deleteMany({ where: { id: techniqueId } });
    await cleanupAdmin();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const authed = (req: request.Test) => req.set('Cookie', cookie).set('X-Requested-With', CSRF);
  const publish = (id: string) => authed(http().post(`${URL}/${id}/publish`));
  const unpublish = (id: string) => authed(http().post(`${URL}/${id}/unpublish`));

  // Crea una obra borrador directo en la base, con imágenes opcionales
  const createArtwork = async (images: { isPrimary: boolean }[] = []) => {
    const artwork = await prisma.artwork.create({
      data: { slug: `artwork-${randomUUID()}`, title: `Publishing ${randomUUID()}`, techniqueId },
    });
    artworkIds.push(artwork.id);
    for (const [index, image] of images.entries()) {
      await prisma.artworkImage.create({
        data: {
          artworkId: artwork.id,
          cloudinaryPublicId: `lienzo/test-${randomUUID()}`,
          position: index + 1,
          isPrimary: image.isPrimary,
        },
      });
    }
    return artwork;
  };

  it('publish and unpublish reject requests without a session', async () => {
    const id = randomUUID();
    await http().post(`${URL}/${id}/publish`).set('X-Requested-With', CSRF).expect(401);
    await http().post(`${URL}/${id}/unpublish`).set('X-Requested-With', CSRF).expect(401);
  });

  it('publish and unpublish reject requests without the CSRF header', async () => {
    const artwork = await createArtwork([{ isPrimary: true }]);
    await http().post(`${URL}/${artwork.id}/publish`).set('Cookie', cookie).expect(403);
    await http().post(`${URL}/${artwork.id}/unpublish`).set('Cookie', cookie).expect(403);

    const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
    expect(stored.publishedAt).toBeNull();
  });

  it('publishes a draft that has a primary image', async () => {
    const artwork = await createArtwork([{ isPrimary: true }]);
    const response = await publish(artwork.id).expect(200);

    expect(response.body.isPublished).toBe(true);
    const age = Date.now() - new Date(response.body.publishedAt as string).getTime();
    expect(Math.abs(age)).toBeLessThan(60_000);
    expect(response.body.slug).toBe(artwork.slug);
    expect(response.body.title).toBe(artwork.title);
    expect(response.body.status).toBe(artwork.status);
  });

  it('publishing twice is idempotent and keeps the original date', async () => {
    const artwork = await createArtwork([{ isPrimary: true }]);
    const first = await publish(artwork.id).expect(200);
    const second = await publish(artwork.id).expect(200);
    expect(second.body.publishedAt).toBe(first.body.publishedAt);
  });

  it('refuses to publish an artwork without images', async () => {
    const artwork = await createArtwork();
    await publish(artwork.id).expect(409);

    const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
    expect(stored.publishedAt).toBeNull();
  });

  it('refuses to publish when no image is primary', async () => {
    const artwork = await createArtwork([{ isPrimary: false }, { isPrimary: false }]);
    await publish(artwork.id).expect(409);

    const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
    expect(stored.publishedAt).toBeNull();
  });

  it('unpublish turns a published artwork back into a draft', async () => {
    const artwork = await createArtwork([{ isPrimary: true }]);
    await publish(artwork.id).expect(200);

    const response = await unpublish(artwork.id).expect(200);
    expect(response.body.isPublished).toBe(false);
    expect(response.body.publishedAt).toBeNull();

    await unpublish(artwork.id).expect(200);
  });

  it('republishing after unpublishing sets a new date', async () => {
    const artwork = await createArtwork([{ isPrimary: true }]);
    await publish(artwork.id).expect(200);
    await prisma.artwork.update({
      where: { id: artwork.id },
      data: { publishedAt: new Date('2020-01-01T00:00:00Z') },
    });
    await unpublish(artwork.id).expect(200);

    const response = await publish(artwork.id).expect(200);
    const republishedAt = new Date(response.body.publishedAt as string).getTime();
    expect(republishedAt).toBeGreaterThan(new Date('2021-01-01T00:00:00Z').getTime());
  });

  it('returns 404 for unknown and malformed ids on both endpoints', async () => {
    for (const id of [randomUUID(), 'abc']) {
      await publish(id).expect(404);
      await unpublish(id).expect(404);
    }
  });
});
