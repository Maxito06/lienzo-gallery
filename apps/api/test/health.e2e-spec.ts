import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs against the test database', () => {
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  });

  it('GET /health returns 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health/db returns 200 and measures the database', async () => {
    const response = await request(app.getHttpServer()).get('/health/db').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.dbLatencyMs).toBe('number');
    expect(response.body.dbLatencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof response.body.memoryRssMb).toBe('number');
    expect(response.body.memoryRssMb).toBeGreaterThan(0);
  });
});
