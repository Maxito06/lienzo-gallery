import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';
import { FakeCloudinary } from './helpers/fake-cloudinary.js';

const CSRF = 'lienzo-web';

describe('Artwork image management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;
  let techniqueId: string;
  const fake = new FakeCloudinary();
  const artworkIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CloudinaryService)
      .useValue(fake)
      .compile();
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

  beforeEach(() => {
    fake.resources.clear();
    fake.deleted.length = 0;
    fake.getResourceCalls.length = 0;
    fake.failWith = undefined;
    fake.failDeleteWith = undefined;
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
  const base = (artworkId: string) => `/admin/artworks/${artworkId}/images`;

  // Crea una obra con n imágenes (position 1..n, la primera principal)
  const createArtwork = async (imageCount: number, published = false) => {
    const artwork = await prisma.artwork.create({
      data: {
        slug: `artwork-${randomUUID()}`,
        title: `Management ${randomUUID()}`,
        techniqueId,
        publishedAt: published ? new Date() : null,
      },
    });
    artworkIds.push(artwork.id);
    const images = [];
    for (let i = 1; i <= imageCount; i++) {
      images.push(
        await prisma.artworkImage.create({
          data: {
            artworkId: artwork.id,
            cloudinaryPublicId: `lienzo/artworks/test-${randomUUID()}`,
            position: i,
            isPrimary: i === 1,
          },
        }),
      );
    }
    return { artwork, images };
  };

  const stored = (artworkId: string) =>
    prisma.artworkImage.findMany({ where: { artworkId }, orderBy: { position: 'asc' } });

  it('primary, order and delete endpoints reject requests without a session or the CSRF header', async () => {
    const { artwork, images } = await createArtwork(2);
    const first = images[0]!;
    const second = images[1]!;
    const calls: [string, string, object?][] = [
      ['post', `${base(artwork.id)}/${second.id}/primary`],
      ['put', `${base(artwork.id)}/order`, { imageIds: [second.id, first.id] }],
      ['delete', `${base(artwork.id)}/${second.id}`],
    ];

    for (const [method, url, body] of calls) {
      const call = (headers: Record<string, string>) => {
        let req = (http() as any)[method](url) as request.Test;
        for (const [name, value] of Object.entries(headers)) req = req.set(name, value);
        return body ? req.send(body) : req;
      };
      await call({ 'X-Requested-With': CSRF }).expect(401);
      await call({ Cookie: cookie }).expect(403);
    }

    const rows = await stored(artwork.id);
    expect(rows.map((r) => r.id)).toEqual([first.id, second.id]);
    expect(rows.map((r) => r.isPrimary)).toEqual([true, false]);
  });

  it('sets another image as primary and leaves exactly one primary', async () => {
    const { artwork, images } = await createArtwork(3);
    const chosen = images[2]!;

    const response = await authed(http().post(`${base(artwork.id)}/${chosen.id}/primary`)).expect(200);
    expect(response.body.primaryImagePublicId).toBe(chosen.cloudinaryPublicId);

    const rows = await stored(artwork.id);
    expect(rows.filter((r) => r.isPrimary).map((r) => r.id)).toEqual([chosen.id]);
  });

  it('setting the current primary again changes nothing', async () => {
    const { artwork, images } = await createArtwork(2);
    const primary = images[0]!;

    await authed(http().post(`${base(artwork.id)}/${primary.id}/primary`)).expect(200);

    const rows = await stored(artwork.id);
    expect(rows.map((r) => [r.id, r.isPrimary])).toEqual([
      [images[0]!.id, true],
      [images[1]!.id, false],
    ]);
  });

  it('returns 404 for unknown, malformed and foreign image ids', async () => {
    const { artwork } = await createArtwork(1);
    const other = await createArtwork(1);
    const foreign = other.images[0]!;

    for (const imageId of [randomUUID(), 'abc', foreign.id]) {
      await authed(http().post(`${base(artwork.id)}/${imageId}/primary`)).expect(404);
      await authed(http().delete(`${base(artwork.id)}/${imageId}`)).expect(404);
    }
    await expect(stored(other.artwork.id)).resolves.toHaveLength(1);
    expect(fake.deleted).toEqual([]);
  });

  it('reorders images and keeps the primary', async () => {
    const { artwork, images } = await createArtwork(3);
    const [a, b, c] = images as [(typeof images)[0], (typeof images)[0], (typeof images)[0]];

    const response = await authed(http().put(`${base(artwork.id)}/order`))
      .send({ imageIds: [c.id, a.id, b.id] })
      .expect(200);

    const returned = response.body.images as { id: string; position: number }[];
    expect(returned.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    expect(returned.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(response.body.primaryImagePublicId).toBe(a.cloudinaryPublicId);
  });

  it('rejects invalid orders and leaves positions untouched', async () => {
    const { artwork, images } = await createArtwork(3);
    const other = await createArtwork(1);
    const [a, b, c] = images as [(typeof images)[0], (typeof images)[0], (typeof images)[0]];
    const foreign = other.images[0]!;

    const invalidBodies: unknown[] = [
      { imageIds: [a.id, b.id] },
      { imageIds: [a.id, b.id, c.id, foreign.id] },
      { imageIds: [a.id, a.id, b.id] },
      { imageIds: [a.id, b.id, foreign.id] },
      { imageIds: 'not-an-array' },
      { imageIds: [] },
      { imageIds: ['x', 'y', 'z'] },
      {},
    ];
    for (const body of invalidBodies) {
      await authed(http().put(`${base(artwork.id)}/order`))
        .send(body as object)
        .expect(400);
    }

    const rows = await stored(artwork.id);
    expect(rows.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it('deletes a non-primary image, compacts positions and removes the file', async () => {
    const { artwork, images } = await createArtwork(3);
    const [a, b, c] = images as [(typeof images)[0], (typeof images)[0], (typeof images)[0]];

    const response = await authed(http().delete(`${base(artwork.id)}/${b.id}`)).expect(200);
    expect(response.body.images.map((i: { id: string }) => i.id)).toEqual([a.id, c.id]);

    const rows = await stored(artwork.id);
    expect(rows.map((r) => [r.id, r.position])).toEqual([
      [a.id, 1],
      [c.id, 2],
    ]);
    expect(fake.deleted).toEqual([b.cloudinaryPublicId]);
  });

  it('deleting the primary image promotes the next one', async () => {
    const { artwork, images } = await createArtwork(3);
    const [a, b, c] = images as [(typeof images)[0], (typeof images)[0], (typeof images)[0]];

    await authed(http().delete(`${base(artwork.id)}/${a.id}`)).expect(200);

    const rows = await stored(artwork.id);
    expect(rows.map((r) => [r.id, r.position, r.isPrimary])).toEqual([
      [b.id, 1, true],
      [c.id, 2, false],
    ]);
  });

  it('deletes the only image of a draft artwork', async () => {
    const { artwork, images } = await createArtwork(1);
    const only = images[0]!;
    fake.resources.set(only.cloudinaryPublicId, {
      publicId: only.cloudinaryPublicId,
      format: 'jpg',
      width: 100,
      height: 100,
      bytes: 100,
    });

    const response = await authed(http().delete(`${base(artwork.id)}/${only.id}`)).expect(200);

    expect(response.body.images).toEqual([]);
    expect(fake.deleted).toContain(only.cloudinaryPublicId);
    expect(fake.resources.has(only.cloudinaryPublicId)).toBe(false);
  });

  it('refuses to delete the last image of a published artwork', async () => {
    const { artwork, images } = await createArtwork(1, true);
    const only = images[0]!;

    await authed(http().delete(`${base(artwork.id)}/${only.id}`)).expect(409);

    await expect(stored(artwork.id)).resolves.toHaveLength(1);
    expect(fake.deleted).toEqual([]);
  });

  it('deleting an image succeeds even if the storage deletion fails', async () => {
    const { artwork, images } = await createArtwork(2);
    const target = images[1]!;
    fake.failDeleteWith = new Error('boom');

    await authed(http().delete(`${base(artwork.id)}/${target.id}`)).expect(200);

    await expect(prisma.artworkImage.findUnique({ where: { id: target.id } })).resolves.toBeNull();
  });

  it('deleting an artwork removes its image files from storage', async () => {
    const { artwork, images } = await createArtwork(2);

    await authed(http().delete(`/admin/artworks/${artwork.id}`)).expect(204);

    expect(fake.deleted.sort()).toEqual(images.map((i) => i.cloudinaryPublicId).sort());
    await expect(stored(artwork.id)).resolves.toEqual([]);
  });
});
