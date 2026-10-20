import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { slugify } from '../src/common/slugify.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';

const CSRF = 'lienzo-web';
const URL = '/admin/series';

describe('Admin series (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;
  const seriesIds: string[] = [];
  const techniqueIds: string[] = [];
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
  });

  afterAll(async () => {
    await prisma.artwork.deleteMany({ where: { id: { in: artworkIds } } });
    await prisma.technique.deleteMany({ where: { id: { in: techniqueIds } } });
    await prisma.series.deleteMany({ where: { id: { in: seriesIds } } });
    await cleanupAdmin();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  // Crea una serie por la API y registra su id para limpiarla al final
  const createSeries = async (nameEs: string, nameEn?: string) => {
    const response = await http()
      .post(URL)
      .set('Cookie', cookie)
      .set('X-Requested-With', CSRF)
      .send(nameEn === undefined ? { nameEs } : { nameEs, nameEn })
      .expect(201);
    seriesIds.push(response.body.id);
    return response.body as {
      id: string;
      slug: string;
      nameEs: string;
      nameEn: string | null;
      artworkCount: number;
    };
  };

  // Crea una técnica y una obra asociada a la serie dada
  const createArtworkInSeries = async (seriesId: string) => {
    const technique = await prisma.technique.create({
      data: { slug: `technique-${randomUUID()}`, nameEs: `Technique ${randomUUID()}` },
    });
    techniqueIds.push(technique.id);
    const artwork = await prisma.artwork.create({
      data: {
        slug: `artwork-${randomUUID()}`,
        title: 'Test artwork',
        techniqueId: technique.id,
        seriesId,
      },
    });
    artworkIds.push(artwork.id);
    return artwork;
  };

  describe('protection', () => {
    it('every series endpoint rejects requests without a session', async () => {
      const id = randomUUID();
      await http().get(URL).expect(401);
      await http().post(URL).set('X-Requested-With', CSRF).send({ nameEs: 'x' }).expect(401);
      await http().patch(`${URL}/${id}`).set('X-Requested-With', CSRF).send({ nameEs: 'x' }).expect(401);
      await http().delete(`${URL}/${id}`).set('X-Requested-With', CSRF).expect(401);
    });

    it('state-changing series endpoints reject requests without the CSRF header', async () => {
      const series = await createSeries(`Csrf ${randomUUID()}`);

      await http().post(URL).set('Cookie', cookie).send({ nameEs: `Nope ${randomUUID()}` }).expect(403);
      await http()
        .patch(`${URL}/${series.id}`)
        .set('Cookie', cookie)
        .send({ nameEs: 'Changed' })
        .expect(403);
      await http().delete(`${URL}/${series.id}`).set('Cookie', cookie).expect(403);

      const stored = await prisma.series.findUniqueOrThrow({ where: { id: series.id } });
      expect(stored.nameEs).toBe(series.nameEs);
    });
  });

  describe('behavior', () => {
    it('creates a series and derives its slug', async () => {
      const nameEs = `Paisajes ${randomUUID()}`;
      const series = await createSeries(`${nameEs} `);
      expect(series.slug).toBe(slugify(nameEs));
      expect(series.nameEs).toBe(nameEs);
      expect(series.nameEn).toBeNull();
      expect(series.artworkCount).toBe(0);
    });

    it('rejects a duplicate name with 409', async () => {
      const nameEs = `Duplicate ${randomUUID()}`;
      await createSeries(nameEs);
      await http()
        .post(URL)
        .set('Cookie', cookie)
        .set('X-Requested-With', CSRF)
        .send({ nameEs })
        .expect(409);
    });

    it('lists series with their artwork count', async () => {
      const series = await createSeries(`Listed ${randomUUID()}`);
      await createArtworkInSeries(series.id);

      const response = await http().get(URL).set('Cookie', cookie).expect(200);
      const found = (response.body as { id: string; artworkCount: number }[]).find(
        (item) => item.id === series.id,
      );
      expect(found?.artworkCount).toBe(1);
    });

    it('updates names but never the slug', async () => {
      const series = await createSeries(`Original ${randomUUID()}`);
      const patch = (body: object) =>
        http()
          .patch(`${URL}/${series.id}`)
          .set('Cookie', cookie)
          .set('X-Requested-With', CSRF)
          .send(body);

      const renamed = await patch({ nameEs: `Renamed ${randomUUID()}` }).expect(200);
      expect(renamed.body.nameEs).not.toBe(series.nameEs);
      expect(renamed.body.slug).toBe(series.slug);

      const withEnglish = await patch({ nameEn: 'Landscapes' }).expect(200);
      expect(withEnglish.body.nameEn).toBe('Landscapes');

      const cleared = await patch({ nameEn: null }).expect(200);
      expect(cleared.body.nameEn).toBeNull();
      expect(cleared.body.slug).toBe(series.slug);
    });

    it('rejects invalid bodies with 400', async () => {
      const post = (body: object) =>
        http().post(URL).set('Cookie', cookie).set('X-Requested-With', CSRF).send(body);

      await post({}).expect(400);
      await post({ nameEs: 123 }).expect(400);
      await post({ nameEs: '' }).expect(400);
      await post({ nameEs: 'a'.repeat(81) }).expect(400);
      await post({ nameEs: 'Valid name', nameEn: 'a'.repeat(81) }).expect(400);
      await post({ nameEs: '???' }).expect(400);

      const series = await createSeries(`Patched ${randomUUID()}`);
      await http()
        .patch(`${URL}/${series.id}`)
        .set('Cookie', cookie)
        .set('X-Requested-With', CSRF)
        .send({})
        .expect(400);
    });

    it('returns 404 for unknown and malformed ids', async () => {
      for (const id of [randomUUID(), 'abc']) {
        await http()
          .patch(`${URL}/${id}`)
          .set('Cookie', cookie)
          .set('X-Requested-With', CSRF)
          .send({ nameEs: 'Whatever' })
          .expect(404);
        await http()
          .delete(`${URL}/${id}`)
          .set('Cookie', cookie)
          .set('X-Requested-With', CSRF)
          .expect(404);
      }
    });

    it('deletes an unused series', async () => {
      const series = await createSeries(`Disposable ${randomUUID()}`);
      await http()
        .delete(`${URL}/${series.id}`)
        .set('Cookie', cookie)
        .set('X-Requested-With', CSRF)
        .expect(204);

      const response = await http().get(URL).set('Cookie', cookie).expect(200);
      const ids = (response.body as { id: string }[]).map((item) => item.id);
      expect(ids).not.toContain(series.id);
    });

    it('deleting a series keeps its artworks and unlinks them', async () => {
      const series = await createSeries(`With artworks ${randomUUID()}`);
      const artwork = await createArtworkInSeries(series.id);

      await http()
        .delete(`${URL}/${series.id}`)
        .set('Cookie', cookie)
        .set('X-Requested-With', CSRF)
        .expect(204);

      const stored = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
      expect(stored.seriesId).toBeNull();
    });
  });
});
