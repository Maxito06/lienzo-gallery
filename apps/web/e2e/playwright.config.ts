import { defineConfig, devices } from '@playwright/test';

// Las pruebas solo leen y navegan; el dueño arranca la API y la web antes de ejecutarlas
export default defineConfig({
  testDir: './',
  // La API gratuita puede tardar en despertar
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    // Las capturas podrían mostrar datos de la sesión de administración
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
