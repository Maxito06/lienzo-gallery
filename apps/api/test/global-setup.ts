import { execSync } from 'node:child_process';

// Antes de las pruebas e2e: deja la base de pruebas vacía y con las migraciones aplicadas.
export default function setup(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('Falta TEST_DATABASE_URL en apps/api/.env');
  }
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: testUrl },
  });
}
