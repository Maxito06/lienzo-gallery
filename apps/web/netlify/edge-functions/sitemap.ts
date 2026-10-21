// Destino de la API: igual que api-proxy.ts (variable API_ORIGIN y URL de respaldo)
const FALLBACK_API_ORIGIN = "https://lienzo-api.onrender.com";
// Debe coincidir con BRAND.siteUrl de src/app/core/brand.config.ts (esta función no puede importar código de Angular).
// Se puede sobrescribir con la variable SITE_URL de Netlify.
const FALLBACK_SITE_URL = "https://lienzo-gallery.netlify.app";

const PAGE_SIZE = 48;
const MAX_PAGES = 50;
const TIMEOUT_MS = 20_000;

interface ListedArtwork {
  slug: string;
}

interface ArtworkPage {
  items: ListedArtwork[];
  totalPages: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Construcción pura del XML. El listado público no trae fecha de publicación, así que no hay <lastmod>.
export function buildSitemapXml(siteUrl: string, slugs: string[]): string {
  const urls = ["/", ...slugs.map((slug) => `/obras/${encodeURIComponent(slug)}`)];
  const entries = urls.map((path) => `  <url><loc>${escapeXml(siteUrl + path)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

async function fetchAllSlugs(apiOrigin: string, signal: AbortSignal): Promise<string[]> {
  const slugs: string[] = [];
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const response = await fetch(`${apiOrigin}/public/artworks?page=${page}&pageSize=${PAGE_SIZE}`, {
      signal,
    });
    if (!response.ok) {
      throw new Error(`API respondió ${response.status}`);
    }
    const data = (await response.json()) as ArtworkPage;
    slugs.push(...data.items.map((item) => item.slug));
    totalPages = data.totalPages;
  }
  return slugs;
}

export default async () => {
  const apiOrigin = (Netlify.env.get("API_ORIGIN") || FALLBACK_API_ORIGIN).replace(/\/+$/, "");
  const siteUrl = (Netlify.env.get("SITE_URL") || FALLBACK_SITE_URL).replace(/\/+$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const slugs = await fetchAllSlugs(apiOrigin, controller.signal);
    return new Response(buildSitemapXml(siteUrl, slugs), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    // Que el buscador reintente más tarde
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
};
