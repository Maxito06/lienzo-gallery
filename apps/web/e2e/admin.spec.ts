import { expect, test, type Locator } from '@playwright/test';

// Solo lectura: nada se crea, edita, publica, oculta ni borra.
// Las credenciales nunca se imprimen: sin trazas ni capturas, y sin pasar el valor a un paso de Playwright.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const email = process.env['E2E_ADMIN_EMAIL'];
const password = process.env['E2E_ADMIN_PASSWORD'];
const MISSING_CREDENTIALS = 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set';

// Escribe el valor sin que aparezca en el título del paso (fill lo mostraría en el informe)
async function setValue(field: Locator, value: string): Promise<void> {
  await field.evaluate((element, text) => {
    const input = element as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('admin route redirects to login when there is no session', async ({ page }) => {
  await page.goto('/admin/artworks');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('login with wrong credentials shows an error and does not sign in', async ({ page }) => {
  await page.goto('/admin/login');
  // Correo inventado: no se usa el real para no activar el límite de intentos del administrador
  await setValue(page.getByLabel('Correo electrónico'), 'nobody@example.com');
  await setValue(page.getByLabel('Contraseña'), 'wrong-password-123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('login with valid credentials reaches the artworks list and logs out', async ({ page }) => {
  test.skip(!email || !password, MISSING_CREDENTIALS);

  await page.goto('/admin/login');
  await setValue(page.getByLabel('Correo electrónico'), email!);
  await setValue(page.getByLabel('Contraseña'), password!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/admin\/artworks/);
  await expect(page.getByRole('heading', { level: 1, name: 'Obras' })).toBeVisible();
  // La primera fila es el encabezado; la segunda, la primera obra
  await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});
