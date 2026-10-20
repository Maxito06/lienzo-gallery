import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_ARTWORK,
  PUBLIC_ID_REGEX,
} from '../src/admin/artwork-images.controller.js';
import { AppModule } from '../src/app.module.js';
import {
  CloudinaryNotConfiguredError,
  CloudinaryService,
  type CloudinaryResource,
} from '../src/cloudinary/cloudinary.service.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';
import { FakeCloudinary } from './helpers/fake-cloudinary.js';

const CSRF = 'lienzo-web';

describe('Artwork images (e2e)', () => {
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

  const createArtwork = async () => {
    const artwork = await prisma.artwork.create({
      data: { slug: `artwork-${randomUUID()}`, title: `Images ${randomUUID()}`, techniqueId },
    });
    artworkIds.push(artwork.id);
    return artwork;
  };

  const newPublicId = () => `lienzo/artworks/test-${randomUUID()}`;
  const goodResource = (publicId: string, overrides: Partial<CloudinaryResource> = {}) => ({
    publicId,
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 500_000,
    ...overrides,
  });

  // Añade el recurso al almacén falso y hace el POST de registro
  const register = (artworkId: string, publicId: string, resource: CloudinaryResource) => {
    fake.resources.set(publicId, resource);
    return authed(http().post(`/admin/artworks/${artworkId}/images`)).send({ publicId });
  };

  const imageCount = (artworkId: string) => prisma.artworkImage.count({ where: { artworkId } });

  it('image endpoints reject requests without a session', async () => {
    const id = randomUUID();
    await http().post(`/admin/artworks/${id}/images/sign`).set('X-Requested-With', CSRF).expect(401);
    await http()
      .post(`/admin/artworks/${id}/images`)
      .set('X-Requested-With', CSRF)
      .send({ publicId: newPublicId() })
      .expect(401);
  });

  it('image endpoints reject requests without the CSRF header', async () => {
    const artwork = await createArtwork();
    const publicId = newPublicId();
    fake.resources.set(publicId, goodResource(publicId));

    await http().post(`/admin/artworks/${artwork.id}/images/sign`).set('Cookie', cookie).expect(403);
    await http()
      .post(`/admin/artworks/${artwork.id}/images`)
      .set('Cookie', cookie)
      .send({ publicId })
      .expect(403);

    await expect(imageCount(artwork.id)).resolves.toBe(0);
  });

  it('sign returns the upload signature and never the secret', async () => {
    const artwork = await createArtwork();
    const response = await authed(http().post(`/admin/artworks/${artwork.id}/images/sign`)).expect(200);

    expect(Object.keys(response.body).sort()).toEqual(
      ['apiKey', 'cloudName', 'publicId', 'signature', 'timestamp', 'uploadPreset'].sort(),
    );
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('secret');

    for (const id of [randomUUID(), 'abc']) {
      await authed(http().post(`/admin/artworks/${id}/images/sign`)).expect(404);
    }
  });

  it('returns a unique publicId with the images prefix', async () => {
    const artwork = await createArtwork();
    const sign = () => authed(http().post(`/admin/artworks/${artwork.id}/images/sign`)).expect(200);

    const first = (await sign()).body.publicId as string;
    const second = (await sign()).body.publicId as string;

    expect(first).toMatch(PUBLIC_ID_REGEX);
    expect(second).toMatch(PUBLIC_ID_REGEX);
    expect(first.startsWith('lienzo/artworks/')).toBe(true);
    expect(first).not.toBe(second);
  });

  it('sign refuses when the artwork already has 8 images', async () => {
    const artwork = await createArtwork();
    for (let position = 1; position <= MAX_IMAGES_PER_ARTWORK; position++) {
      await prisma.artworkImage.create({
        data: { artworkId: artwork.id, cloudinaryPublicId: newPublicId(), position },
      });
    }
    await authed(http().post(`/admin/artworks/${artwork.id}/images/sign`)).expect(409);
  });

  it('registers the first image as primary and the next ones in order', async () => {
    const artwork = await createArtwork();
    const first = newPublicId();
    const second = newPublicId();

    const firstResponse = await register(artwork.id, first, goodResource(first)).expect(201);
    expect(firstResponse.body.images).toHaveLength(1);
    expect(firstResponse.body.images[0]).toMatchObject({
      cloudinaryPublicId: first,
      position: 1,
      isPrimary: true,
    });

    const secondResponse = await register(artwork.id, second, goodResource(second)).expect(201);
    expect(secondResponse.body.id).toBe(artwork.id);
    expect(secondResponse.body.images).toHaveLength(2);
    expect(secondResponse.body.images[1]).toMatchObject({
      cloudinaryPublicId: second,
      position: 2,
      isPrimary: false,
    });
    expect(secondResponse.body.primaryImagePublicId).toBe(first);
  });

  it('rejects an image that does not exist in storage', async () => {
    const artwork = await createArtwork();
    await authed(http().post(`/admin/artworks/${artwork.id}/images`))
      .send({ publicId: newPublicId() })
      .expect(400);
    await expect(imageCount(artwork.id)).resolves.toBe(0);
  });

  it('rejects and removes images with an unsupported format, too many bytes or too many pixels', async () => {
    const artwork = await createArtwork();
    const cases: Partial<CloudinaryResource>[] = [
      { format: 'gif' },
      { bytes: MAX_IMAGE_BYTES + 1 },
      { width: 5001, height: 5000 },
    ];
    for (const overrides of cases) {
      const publicId = newPublicId();
      await register(artwork.id, publicId, goodResource(publicId, overrides)).expect(422);
      expect(fake.deleted).toContain(publicId);
    }
    await expect(imageCount(artwork.id)).resolves.toBe(0);
  });

  it('accepts images exactly at the limits', async () => {
    const artwork = await createArtwork();
    const publicId = newPublicId();
    await register(
      artwork.id,
      publicId,
      goodResource(publicId, { bytes: MAX_IMAGE_BYTES, width: 5000, height: 5000, format: 'jpg' }),
    ).expect(201);
  });

  it('rejects public ids outside the artwork folder', async () => {
    const artwork = await createArtwork();
    for (const publicId of ['other/folder/abc', 'lienzo/artworks/../x', 'lienzo/artworks/', '', 123]) {
      await authed(http().post(`/admin/artworks/${artwork.id}/images`))
        .send({ publicId })
        .expect(400);
    }
    expect(fake.getResourceCalls).toEqual([]);
  });

  it('refuses to register the same image twice, even for another artwork', async () => {
    const artwork = await createArtwork();
    const other = await createArtwork();
    const publicId = newPublicId();

    await register(artwork.id, publicId, goodResource(publicId)).expect(201);
    await register(artwork.id, publicId, goodResource(publicId)).expect(409);
    await register(other.id, publicId, goodResource(publicId)).expect(409);
    await expect(imageCount(other.id)).resolves.toBe(0);
  });

  it('refuses a 9th image', async () => {
    const artwork = await createArtwork();
    for (let i = 0; i < MAX_IMAGES_PER_ARTWORK; i++) {
      const publicId = newPublicId();
      await register(artwork.id, publicId, goodResource(publicId)).expect(201);
    }
    fake.getResourceCalls.length = 0;

    const ninth = newPublicId();
    await register(artwork.id, ninth, goodResource(ninth)).expect(409);
    expect(fake.getResourceCalls).toEqual([]);
    await expect(imageCount(artwork.id)).resolves.toBe(MAX_IMAGES_PER_ARTWORK);
  });

  it('returns 404 when registering on an unknown or malformed artwork id', async () => {
    for (const id of [randomUUID(), 'abc']) {
      const publicId = newPublicId();
      await register(id, publicId, goodResource(publicId)).expect(404);
    }
  });

  it('maps storage failures', async () => {
    const artwork = await createArtwork();
    const publicId = newPublicId();
    fake.resources.set(publicId, goodResource(publicId));
    const post = () =>
      authed(http().post(`/admin/artworks/${artwork.id}/images`)).send({ publicId });

    fake.failWith = new Error('boom');
    await post().expect(502);

    fake.failWith = new CloudinaryNotConfiguredError('x');
    await post().expect(503);

    await expect(imageCount(artwork.id)).resolves.toBe(0);
  });

  it('an artwork whose first image was registered can be published', async () => {
    const artwork = await createArtwork();
    const publicId = newPublicId();
    await register(artwork.id, publicId, goodResource(publicId)).expect(201);

    const response = await authed(http().post(`/admin/artworks/${artwork.id}/publish`)).expect(200);
    expect(response.body.isPublished).toBe(true);
  });

  it('the database rejects two images with the same public id', async () => {
    const first = await createArtwork();
    const second = await createArtwork();
    const publicId = newPublicId();

    await prisma.artworkImage.create({
      data: { artworkId: first.id, cloudinaryPublicId: publicId, position: 1 },
    });
    await expect(
      prisma.artworkImage.create({
        data: { artworkId: second.id, cloudinaryPublicId: publicId, position: 1 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('the database rejects two images with the same position in one artwork', async () => {
    const artwork = await createArtwork();

    await prisma.artworkImage.create({
      data: { artworkId: artwork.id, cloudinaryPublicId: newPublicId(), position: 1 },
    });
    await expect(
      prisma.artworkImage.create({
        data: { artworkId: artwork.id, cloudinaryPublicId: newPublicId(), position: 1 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('simultaneous registrations of the same image produce one success and one conflict', async () => {
    const artwork = await createArtwork();
    const publicId = newPublicId();
    fake.resources.set(publicId, goodResource(publicId));
    const post = () =>
      authed(http().post(`/admin/artworks/${artwork.id}/images`)).send({ publicId });

    const responses = await Promise.all([post(), post()]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    await expect(prisma.artworkImage.count({ where: { cloudinaryPublicId: publicId } })).resolves.toBe(1);
  });
});
