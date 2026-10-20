import { defineConfig } from 'vitest/config';
import { getTestDatabaseUrl } from './test/test-db.js';

// Se evalúa al cargar la configuración: aborta si la base de pruebas no es segura.
const testDatabaseUrl = getTestDatabaseUrl();

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl,
      // Red de seguridad: ninguna prueba debe poder llegar al Cloudinary real
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
      CLOUDINARY_UPLOAD_PRESET: '',
    },
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  resolve: { tsconfigPaths: true },
});
