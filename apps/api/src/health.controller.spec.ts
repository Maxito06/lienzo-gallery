import { HEADERS_METADATA } from '@nestjs/common/constants.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  // Sin base de datos: si check() la tocara, este objeto fallaría
  const prisma = new Proxy({}, { get: () => { throw new Error('database must not be used'); } });
  const controller = new HealthController(prisma as never);

  it('returns status ok without touching the database', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('sends Cache-Control no-store', () => {
    const headers = Reflect.getMetadata(HEADERS_METADATA, HealthController.prototype.check);
    expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });
});
