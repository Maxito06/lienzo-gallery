import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PublicCatalogService } from '../src/public/public-catalog.service.js';
import { PrismaService } from '../src/prisma.service.js';
import { createAdminSession } from './helpers/admin-session.js';

const CSRF = 'lienzo-web';
const PUBLIC = '/public';

type Item = Record<string, any>;

describe('Public catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let cleanupAdmin: () => Promise<void>;

  const suffix = randomUUID();
  const t1Slug = `t1-${suffix}`;
  const t2Slug = `t2-${suffix}`;
  const t3Slug = `t3-${suffix}`;
  const s1Slug = `s1-${suffix}`;
  const s2Slug = `s2-${suffix}`;
  const techniqueIds: string[] = [];
  const seriesIds: string[] = [];
  const artworkIds: string[] = [];

  // Slugs de las obras de esta prueba
  const slugs = {
    p1: `p1-${suffix}`,
    p2: `p2-${suffix}`,
    p3: `p3-${suffix}`,
    p4: `p4-${suffix}`,
    p5: `p5-${suffix}`,
    d1: `d1-${suffix}`,
    d2: `d2-${suffix}`,
    d3: `d3-${suffix}`,
  };
  const publishedSlugs = [slugs.p1, slugs.p2, slugs.p3, slugs.p4, slugs.p5];
  const draftSlugs = [slugs.d1, slugs.d2, slugs.d3];
  let p5Id: string;

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

    const techniques = await Promise.all(
      [t1Slug, t2Slug, t3Slug].map((slug) =>
        prisma.technique.create({ data: { slug, nameEs: `Name ${slug}` } }),
      ),
    );
    const series = await Promise.all(
      [s1Slug, s2Slug].map((slug) =>
        prisma.series.create({ data: { slug, nameEs: `Name ${slug}` } }),
      ),
    );
    techniqueIds.push(...techniques.map((t) => t.id));
    seriesIds.push(...series.map((s) => s.id));
    const [t1, t2, t3] = techniques as [(typeof techniques)[0], (typeof techniques)[0], (typeof techniques)[0]];
    const [s1, s2] = series as [(typeof series)[0], (typeof series)[0]];

    const create = async (
      slug: string,
      data: {
        techniqueId: string;
        seriesId?: string;
        status?: 'AVAILABLE' | 'RESERVED' | 'SOLD';
        publishedAt?: Date;
        withImages?: boolean;
        extra?: object;
      },
    ) => {
      const artwork = await prisma.artwork.create({
        data: {
          slug,
          title: `Title ${slug}`,
          techniqueId: data.techniqueId,
          seriesId: data.seriesId,
          status: data.status,
          publishedAt: data.publishedAt,
          ...data.extra,
        },
      });
      artworkIds.push(artwork.id);
      if (data.withImages) {
        await prisma.artworkImage.create({
          data: {
            artworkId: artwork.id,
            cloudinaryPublicId: `lienzo/test-${slug}-b`,
            position: 2,
          },
        });
        await prisma.artworkImage.create({
          data: {
            artworkId: artwork.id,
            cloudinaryPublicId: `lienzo/test-${slug}-a`,
            position: 1,
            isPrimary: true,
          },
        });
      }
      return artwork;
    };

    await create(slugs.p1, {
      techniqueId: t1.id,
      seriesId: s1.id,
      status: 'AVAILABLE',
      publishedAt: new Date('2026-03-01T00:00:00Z'),
      withImages: true,
      extra: {
        year: 2020,
        widthCm: 30.5,
        heightCm: 40,
        referencePriceCop: 1_000_000,
        descriptionEs: 'Descripción',
        descriptionEn: 'Description',
      },
    });
    await create(slugs.p2, {
      techniqueId: t2.id,
      seriesId: s1.id,
      status: 'RESERVED',
      publishedAt: new Date('2026-02-01T00:00:00Z'),
      withImages: true,
    });
    await create(slugs.p3, {
      techniqueId: t1.id,
      seriesId: s1.id,
      status: 'SOLD',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      withImages: true,
    });
    await create(slugs.p4, {
      techniqueId: t2.id,
      status: 'SOLD',
      publishedAt: new Date('2026-04-01T00:00:00Z'),
      withImages: true,
    });
    const p5 = await create(slugs.p5, {
      techniqueId: t1.id,
      publishedAt: new Date('2025-12-01T00:00:00Z'),
      withImages: true,
    });
    p5Id = p5.id;

    await create(slugs.d1, { techniqueId: t1.id, seriesId: s1.id, withImages: true });
    await create(slugs.d2, { techniqueId: t3.id, seriesId: s2.id, withImages: true });
    await create(slugs.d3, { techniqueId: t3.id });
  });

  afterAll(async () => {
    await prisma.artworkImage.deleteMany({ where: { artworkId: { in: artworkIds } } });
    await prisma.artwork.deleteMany({ where: { id: { in: artworkIds } } });
    await prisma.series.deleteMany({ where: { id: { in: seriesIds } } });
    await prisma.technique.deleteMany({ where: { id: { in: techniqueIds } } });
    await cleanupAdmin();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  // Recorre todas las páginas de la lista pública
  const fetchAllPublic = async (query = ''): Promise<Item[]> => {
    const items: Item[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const response = await http()
        .get(`${PUBLIC}/artworks?pageSize=48&page=${page}${query}`)
        .expect(200);
      items.push(...(response.body.items as Item[]));
      totalPages = response.body.totalPages as number;
      page++;
    }
    return items;
  };

  it('lists only published artworks and never a draft', async () => {
    const found = (await fetchAllPublic()).map((item) => item.slug as string);
    for (const slug of publishedSlugs) expect(found).toContain(slug);
    for (const slug of draftSlugs) expect(found).not.toContain(slug);
  });

  it('a draft and an unknown slug get the same 404 response', async () => {
    const draft = await http().get(`${PUBLIC}/artworks/${slugs.d1}`).expect(404);
    const unknown = await http().get(`${PUBLIC}/artworks/nope-${randomUUID()}`).expect(404);
    expect(draft.body).toEqual(unknown.body);
    await http().get(`${PUBLIC}/artworks/Bad%20Slug!`).expect(404);
  });

  it('returns the public detail of a published artwork with only public fields', async () => {
    const response = await http().get(`${PUBLIC}/artworks/${slugs.p1}`).expect(200);
    const body = response.body as Item;

    expect(Object.keys(body).sort()).toEqual(
      [
        'slug',
        'title',
        'status',
        'year',
        'isDemo',
        'widthCm',
        'heightCm',
        'referencePriceCop',
        'descriptionEs',
        'descriptionEn',
        'publishedAt',
        'technique',
        'series',
        'images',
      ].sort(),
    );
    expect(body.widthCm).toBe(30.5);
    expect(body.heightCm).toBe(40);
    expect(Object.keys(body.technique).sort()).toEqual(['nameEn', 'nameEs', 'slug']);
    expect(Object.keys(body.series).sort()).toEqual(['nameEn', 'nameEs', 'slug']);
    expect((body.images as Item[]).map((image) => image.position)).toEqual([1, 2]);
    expect(Object.keys((body.images as Item[])[0] as Item).sort()).toEqual([
      'cloudinaryPublicId',
      'isPrimary',
      'position',
    ]);
    for (const forbidden of ['id', 'createdAt', 'updatedAt']) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it('list items expose only public fields', async () => {
    const response = await http().get(`${PUBLIC}/artworks?series=${s1Slug}`).expect(200);
    const item = (response.body.items as Item[])[0] as Item;
    expect(Object.keys(item).sort()).toEqual(
      [
        'slug',
        'title',
        'status',
        'year',
        'isDemo',
        'technique',
        'series',
        'primaryImagePublicId',
      ].sort(),
    );
  });

  it('unpublishing removes an artwork from the public API and republishing restores it', async () => {
    const adminPost = (path: string) =>
      http().post(path).set('Cookie', cookie).set('X-Requested-With', CSRF);

    await http().get(`${PUBLIC}/artworks/${slugs.p5}`).expect(200);
    expect((await fetchAllPublic()).map((i) => i.slug)).toContain(slugs.p5);

    await adminPost(`/admin/artworks/${p5Id}/unpublish`).expect(200);
    await http().get(`${PUBLIC}/artworks/${slugs.p5}`).expect(404);
    expect((await fetchAllPublic()).map((i) => i.slug)).not.toContain(slugs.p5);

    await adminPost(`/admin/artworks/${p5Id}/publish`).expect(200);
    await http().get(`${PUBLIC}/artworks/${slugs.p5}`).expect(200);
    expect((await fetchAllPublic()).map((i) => i.slug)).toContain(slugs.p5);
  });

  it('filters by series, technique and status', async () => {
    const slugsOf = (items: Item[]) => items.map((item) => item.slug as string).sort();

    const bySeries = await fetchAllPublic(`&series=${s1Slug}`);
    expect(slugsOf(bySeries)).toEqual([slugs.p1, slugs.p2, slugs.p3].sort());

    const byTechnique = await fetchAllPublic(`&technique=${t2Slug}`);
    expect(slugsOf(byTechnique)).toEqual([slugs.p2, slugs.p4].sort());

    const bySold = await fetchAllPublic(`&series=${s1Slug}&status=SOLD`);
    expect(slugsOf(bySold)).toEqual([slugs.p3]);

    const combined = await fetchAllPublic(`&series=${s1Slug}&technique=${t1Slug}`);
    expect(slugsOf(combined)).toEqual([slugs.p1, slugs.p3].sort());

    const unknown = await http().get(`${PUBLIC}/artworks?series=nope-${suffix}`).expect(200);
    expect(unknown.body.items).toEqual([]);
    expect(unknown.body.total).toBe(0);
  });

  it('lists only techniques and series that have published artworks, counting only published', async () => {
    const techniques = (await http().get(`${PUBLIC}/techniques`).expect(200)).body as Item[];
    const series = (await http().get(`${PUBLIC}/series`).expect(200)).body as Item[];

    expect(techniques.find((t) => t.slug === t3Slug)).toBeUndefined();
    expect(series.find((s) => s.slug === s2Slug)).toBeUndefined();

    expect(techniques.find((t) => t.slug === t1Slug)?.artworkCount).toBe(3);
    expect(techniques.find((t) => t.slug === t2Slug)?.artworkCount).toBe(2);
    expect(series.find((s) => s.slug === s1Slug)?.artworkCount).toBe(3);
    expect(Object.keys(series.find((s) => s.slug === s1Slug) as Item).sort()).toEqual([
      'artworkCount',
      'nameEn',
      'nameEs',
      'slug',
    ]);
  });

  it('paginates with a stable order', async () => {
    const page = (n: number) =>
      http().get(`${PUBLIC}/artworks?series=${s1Slug}&pageSize=2&page=${n}`).expect(200);

    const first = (await page(1)).body;
    const second = (await page(2)).body;
    const third = (await page(3)).body;

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(first.total).toBe(3);
    expect(first.totalPages).toBe(2);
    expect(third.items).toEqual([]);

    const order = [...first.items, ...second.items].map((item: Item) => item.slug);
    expect(order).toEqual([slugs.p1, slugs.p2, slugs.p3]);
  });

  it('rejects invalid query parameters with 400', async () => {
    const queries = [
      'page=0',
      'page=abc',
      'pageSize=0',
      'pageSize=49',
      'status=GONE',
      'series=Bad',
      'page=1&page=2',
      'page=100001',
      'page=9007199254740991',
    ];
    for (const query of queries) {
      await http().get(`${PUBLIC}/artworks?${query}`).expect(400);
    }
  });

  it('public endpoints need no session or CSRF header and set no cookie', async () => {
    for (const path of [
      '/artworks',
      `/artworks/${slugs.p1}`,
      '/techniques',
      '/series',
    ]) {
      const response = await http().get(`${PUBLIC}${path}`).expect(200);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it('listPublishedSlugs returns only published artworks', async () => {
    const result = await app.get(PublicCatalogService).listPublishedSlugs();
    const found = result.map((entry) => entry.slug);
    for (const slug of publishedSlugs) expect(found).toContain(slug);
    for (const slug of draftSlugs) expect(found).not.toContain(slug);
  });
});
