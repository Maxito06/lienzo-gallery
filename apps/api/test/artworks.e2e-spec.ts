import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { slugify } from '../src/common/slugify.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';

const CSRF = 'lienzo-web';
const URL = '/admin/artworks';

type ArtworkBody = Record<string, any>;

describe('Admin artworks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;
  let techniqueId: string;
  let otherTechniqueId: string;
  let seriesId: string;
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
    const otherTechnique = await prisma.technique.create({
      data: { slug: `technique-${randomUUID()}`, nameEs: `Technique ${randomUUID()}` },
    });
    const series = await prisma.series.create({
      data: { slug: `series-${randomUUID()}`, nameEs: `Series ${randomUUID()}` },
    });
    techniqueId = technique.id;
    otherTechniqueId = otherTechnique.id;
    seriesId = series.id;
  });

  afterAll(async () => {
    await prisma.artworkImage.deleteMany({ where: { artworkId: { in: artworkIds } } });
    await prisma.artwork.deleteMany({ where: { id: { in: artworkIds } } });
    await prisma.series.deleteMany({ where: { id: seriesId } });
    await prisma.technique.deleteMany({ where: { id: { in: [techniqueId, otherTechniqueId] } } });
    await cleanupAdmin();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const authed = (req: request.Test) => req.set('Cookie', cookie).set('X-Requested-With', CSRF);

  // Crea una obra por la API y registra su id para limpiarla al final
  const createArtwork = async (body: object): Promise<ArtworkBody> => {
    const response = await authed(http().post(URL)).send(body).expect(201);
    artworkIds.push(response.body.id);
    return response.body;
  };

  describe('protection', () => {
    it('every artwork endpoint rejects requests without a session', async () => {
      const id = randomUUID();
      await http().get(URL).expect(401);
      await http().get(`${URL}/${id}`).expect(401);
      await http()
        .post(URL)
        .set('X-Requested-With', CSRF)
        .send({ title: 'x', techniqueId })
        .expect(401);
      await http().patch(`${URL}/${id}`).set('X-Requested-With', CSRF).send({ year: 2000 }).expect(401);
      await http().delete(`${URL}/${id}`).set('X-Requested-With', CSRF).expect(401);
    });

    it('state-changing artwork endpoints reject requests without the CSRF header', async () => {
      const artwork = await createArtwork({ title: `Csrf ${randomUUID()}`, techniqueId });

      await http().post(URL).set('Cookie', cookie).send({ title: 'Nope', techniqueId }).expect(403);
      await http()
        .patch(`${URL}/${artwork.id}`)
        .set('Cookie', cookie)
        .send({ title: 'Changed' })
        .expect(403);
      await http().delete(`${URL}/${artwork.id}`).set('Cookie', cookie).expect(403);

      const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
      expect(stored.title).toBe(artwork.title);
    });
  });

  describe('create', () => {
    it('creates a draft with defaults', async () => {
      const title = `Draft ${randomUUID()}`;
      const artwork = await createArtwork({ title, techniqueId });
      expect(artwork.status).toBe('AVAILABLE');
      expect(artwork.isPublished).toBe(false);
      expect(artwork.publishedAt).toBeNull();
      expect(artwork.series).toBeNull();
      expect(artwork.year).toBeNull();
      expect(artwork.images).toEqual([]);
      expect(artwork.slug).toBe(slugify(title));
    });

    it('creates an artwork with every optional field', async () => {
      const artwork = await createArtwork({
        title: `Full ${randomUUID()}`,
        techniqueId,
        seriesId,
        year: 2020,
        widthCm: 30.5,
        heightCm: 40,
        status: 'RESERVED',
        referencePriceCop: 1_500_000,
        descriptionEs: 'Descripción en español',
        descriptionEn: 'Description in English',
      });
      expect(artwork.year).toBe(2020);
      expect(artwork.widthCm).toBe(30.5);
      expect(artwork.heightCm).toBe(40);
      expect(artwork.status).toBe('RESERVED');
      expect(artwork.referencePriceCop).toBe(1_500_000);
      expect(artwork.descriptionEs).toBe('Descripción en español');
      expect(artwork.descriptionEn).toBe('Description in English');
      expect(artwork.series.id).toBe(seriesId);
      expect(artwork.technique.id).toBe(techniqueId);
    });

    it('ignores publishedAt and isDemo sent by the client', async () => {
      const artwork = await createArtwork({
        title: `Sneaky ${randomUUID()}`,
        techniqueId,
        publishedAt: '2026-01-01T00:00:00Z',
        isDemo: true,
      });
      expect(artwork.isPublished).toBe(false);
      const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
      expect(stored.isDemo).toBe(false);
      expect(stored.publishedAt).toBeNull();
    });

    it('generates unique slugs for repeated titles', async () => {
      const title = `Repeated ${randomUUID()}`;
      const base = slugify(title);
      const first = await createArtwork({ title, techniqueId });
      const second = await createArtwork({ title, techniqueId });
      const third = await createArtwork({ title, techniqueId });
      expect([first.slug, second.slug, third.slug]).toEqual([base, `${base}-2`, `${base}-3`]);
    });

    it('rejects an unknown technique or series with 400', async () => {
      await authed(http().post(URL)).send({ title: 'Ghost', techniqueId: randomUUID() }).expect(400);
      await authed(http().post(URL))
        .send({ title: 'Ghost', techniqueId, seriesId: randomUUID() })
        .expect(400);
    });

    it('rejects invalid bodies with 400', async () => {
      const post = (body: object) => authed(http().post(URL)).send(body);
      await post({ techniqueId }).expect(400);
      await post({ title: 'Valid', techniqueId, status: 'GONE' }).expect(400);
      await post({ title: 'Valid', techniqueId, widthCm: 12.34 }).expect(400);
      await post({ title: 'Valid', techniqueId: 'not-a-uuid' }).expect(400);
    });
  });

  describe('read', () => {
    it('lists drafts and published artworks with relations', async () => {
      const published = await prisma.artwork.create({
        data: {
          slug: `published-${randomUUID()}`,
          title: 'Published',
          techniqueId,
          seriesId,
          publishedAt: new Date(),
        },
      });
      artworkIds.push(published.id);
      const draft = await createArtwork({ title: `Listed draft ${randomUUID()}`, techniqueId });

      const response = await authed(http().get(URL)).expect(200);
      const items = response.body as ArtworkBody[];
      const foundPublished = items.find((item) => item.id === published.id);
      const foundDraft = items.find((item) => item.id === draft.id);

      expect(foundPublished?.isPublished).toBe(true);
      expect(foundPublished?.technique.id).toBe(techniqueId);
      expect(foundPublished?.series.id).toBe(seriesId);
      expect(foundPublished?.imageCount).toBe(0);
      expect(foundDraft?.isPublished).toBe(false);
      expect(foundDraft?.series).toBeNull();
    });

    it('returns an artwork with its images ordered by position', async () => {
      const artwork = await createArtwork({ title: `Images ${randomUUID()}`, techniqueId });
      await prisma.artworkImage.create({
        data: { artworkId: artwork.id, cloudinaryPublicId: 'lienzo/test-second', position: 2 },
      });
      await prisma.artworkImage.create({
        data: {
          artworkId: artwork.id,
          cloudinaryPublicId: 'lienzo/test-first',
          position: 1,
          isPrimary: true,
        },
      });

      const detail = await authed(http().get(`${URL}/${artwork.id}`)).expect(200);
      const positions = (detail.body.images as { position: number }[]).map((i) => i.position);
      expect(positions).toEqual([1, 2]);
      expect(detail.body.primaryImagePublicId).toBe('lienzo/test-first');

      const list = await authed(http().get(URL)).expect(200);
      const item = (list.body as ArtworkBody[]).find((entry) => entry.id === artwork.id);
      expect(item?.primaryImagePublicId).toBe('lienzo/test-first');
      expect(item?.imageCount).toBe(2);
    });
  });

  describe('update and delete', () => {
    it('updates fields but never the slug', async () => {
      const artwork = await createArtwork({
        title: `Original ${randomUUID()}`,
        techniqueId,
        seriesId,
        year: 2019,
      });
      const patch = (body: object) => authed(http().patch(`${URL}/${artwork.id}`)).send(body);

      const renamed = await patch({ title: `Renamed ${randomUUID()}` }).expect(200);
      expect(renamed.body.title).not.toBe(artwork.title);
      expect(renamed.body.slug).toBe(artwork.slug);

      const sold = await patch({ status: 'SOLD' }).expect(200);
      expect(sold.body.status).toBe('SOLD');

      const unlinked = await patch({ seriesId: null }).expect(200);
      expect(unlinked.body.series).toBeNull();

      const noYear = await patch({ year: null }).expect(200);
      expect(noYear.body.year).toBeNull();

      const moved = await patch({ techniqueId: otherTechniqueId }).expect(200);
      expect(moved.body.technique.id).toBe(otherTechniqueId);
      expect(moved.body.slug).toBe(artwork.slug);
    });

    it('rejects an empty patch and returns 404 for unknown and malformed ids', async () => {
      const artwork = await createArtwork({ title: `Empty patch ${randomUUID()}`, techniqueId });
      await authed(http().patch(`${URL}/${artwork.id}`)).send({}).expect(400);

      for (const id of [randomUUID(), 'abc']) {
        await authed(http().get(`${URL}/${id}`)).expect(404);
        await authed(http().patch(`${URL}/${id}`)).send({ year: 2000 }).expect(404);
        await authed(http().delete(`${URL}/${id}`)).expect(404);
      }
    });

    it('deletes an artwork together with its images', async () => {
      const artwork = await createArtwork({ title: `Doomed ${randomUUID()}`, techniqueId });
      await prisma.artworkImage.create({
        data: { artworkId: artwork.id, cloudinaryPublicId: 'lienzo/test-doomed', position: 1 },
      });

      await authed(http().delete(`${URL}/${artwork.id}`)).expect(204);

      await expect(prisma.artwork.findUnique({ where: { id: artwork.id } })).resolves.toBeNull();
      await expect(prisma.artworkImage.count({ where: { artworkId: artwork.id } })).resolves.toBe(0);
    });
  });
});
