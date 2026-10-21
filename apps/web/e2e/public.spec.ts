import { expect, test, type Locator, type Page } from '@playwright/test';

// Todas las pruebas son de solo lectura: navegan y comprueban, nada se escribe

// Tarjetas de obra: enlaces dentro de la sección "Obras" (los filtros son botones)
function artworkCards(page: Page): Locator {
  return page.getByRole('region', { name: 'Obras' }).getByRole('link');
}

async function openFirstArtwork(page: Page): Promise<string> {
  await page.goto('/');
  const card = artworkCards(page).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/obras\/[^/?#]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return new URL(page.url()).pathname;
}

test('gallery shows the hero title and at least one artwork card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(artworkCards(page).first()).toBeVisible();
});

test('filtering by technique adds the chip and clearing removes it', async ({ page }) => {
  await page.goto('/');
  await expect(artworkCards(page).first()).toBeVisible();

  await page.getByRole('button', { name: /^Técnica/ }).click();
  const firstOption = page.locator('#filter-panel-technique').getByRole('button').first();
  await expect(firstOption).toBeVisible();
  const label = (await firstOption.innerText()).replace('✓', '').trim();
  await firstOption.click();

  await expect(page).toHaveURL(/[?&]technique=/);
  const chip = page.getByRole('button', { name: `Quitar filtro ${label}` });
  await expect(chip).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page).not.toHaveURL(/technique=/);
  await expect(chip).toHaveCount(0);
});

test('opening an artwork from the gallery shows its title and the viewer', async ({ page }) => {
  await page.goto('/');
  const card = artworkCards(page).first();
  await expect(card).toBeVisible();
  const title = (await card.getByRole('heading', { level: 2 }).innerText()).trim();
  await card.click();

  await expect(page).toHaveURL(/\/obras\/[^/?#]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByRole('group', { name: /^Imágenes de / })).toBeVisible();
});

test('view mode buttons toggle between the wall and the artwork only', async ({ page }) => {
  await openFirstArtwork(page);
  const wall = page.getByRole('button', { name: 'En la pared' });
  const only = page.getByRole('button', { name: 'Solo la obra' });
  if ((await only.count()) === 0) {
    test.info().annotations.push({ type: 'note', description: 'No wall view for this artwork' });
    test.skip(true, 'The first artwork has no wall view mode buttons');
  }

  await expect(wall).toHaveAttribute('aria-pressed', 'true');
  await only.click();
  await expect(only).toHaveAttribute('aria-pressed', 'true');
  await expect(wall).toHaveAttribute('aria-pressed', 'false');
  await wall.click();
  await expect(wall).toHaveAttribute('aria-pressed', 'true');
});

test('WhatsApp link on the detail page carries the title and the artwork URL', async ({ page }) => {
  const path = await openFirstArtwork(page);
  const title = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  const link = page.getByRole('link', { name: 'Preguntar por esta obra en WhatsApp' });
  if ((await link.count()) === 0) {
    test.skip(true, 'The first artwork has no WhatsApp link (sold or number not configured)');
  }

  // El origen del sitio sale del canonical, que ya trae la URL pública configurada
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBeTruthy();
  const siteUrl = canonical!.slice(0, canonical!.length - path.length);

  const href = await link.getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\//);
  expect(href).toContain(encodeURIComponent(title));
  expect(href).toContain(encodeURIComponent(`${siteUrl}${path}`));
});

test('SEO tags on the detail page', async ({ page }) => {
  const path = await openFirstArtwork(page);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', new RegExp(`${path}$`));
  const href = await canonical.getAttribute('href');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', href!);

  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const data = JSON.parse((await jsonLd.textContent()) ?? '') as Record<string, unknown>;
  expect(data['@type']).toBe('VisualArtwork');
  expect(data).not.toHaveProperty('offers');
  expect(data).not.toHaveProperty('price');
});

test('SEO tags on the gallery', async ({ page }) => {
  await page.goto('/');
  await expect(artworkCards(page).first()).toBeVisible();

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', /\/$/);
  const before = await canonical.getAttribute('href');
  expect(before).not.toContain('?');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

  // Con un filtro aplicado el canonical no cambia
  await page.getByRole('button', { name: /^Técnica/ }).click();
  await page.locator('#filter-panel-technique').getByRole('button').first().click();
  await expect(page).toHaveURL(/[?&]technique=/);
  await expect(canonical).toHaveAttribute('href', before!);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test('unknown route shows the not-found page without canonical', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe');
  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('robots.txt is served and blocks the admin area', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('Disallow: /admin/');
});

test('keyboard navigation in the viewer changes the photo', async ({ page }) => {
  const maxAttempts = 6;
  await page.goto('/');
  await expect(artworkCards(page).first()).toBeVisible();
  const attempts = Math.min(maxAttempts, await artworkCards(page).count());

  let found = false;
  for (let i = 0; i < attempts && !found; i++) {
    await page.goto('/');
    const card = artworkCards(page).nth(i);
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    found = (await page.getByRole('button', { name: 'Foto siguiente' }).count()) > 0;
  }
  if (!found) {
    test.skip(true, `None of the first ${attempts} artworks has more than one photo`);
  }

  await expect(page.getByRole('button', { name: 'Foto 1', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('group', { name: /^Imágenes de / }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Foto 2', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
