import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));
const ALLOWED_PREFIXES = ['admin/', 'public/', 'seed/'];
const PRISMA_ACCESS =
  /\.(artwork|artworkImage|technique|series)\.(find\w*|count|aggregate|groupBy|create\w*|update\w*|upsert|delete\w*)\(/;

// Lista recursiva de archivos .ts, sin la carpeta generated ni los spec
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue;
      files.push(...listSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const relativePath = (file: string) => relative(SRC_DIR, file).split(sep).join('/');

describe('architecture', () => {
  it('only admin, public and seed code read artworks, techniques or series through Prisma', () => {
    const offenders = listSourceFiles(SRC_DIR)
      .map(relativePath)
      .filter((path) => !ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix)))
      .filter((path) => PRISMA_ACCESS.test(readFileSync(join(SRC_DIR, path), 'utf8')));

    expect(offenders, `Files accessing catalog tables outside admin/public/seed: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the public service builds every artwork query with publishedWhere', () => {
    const lines = readFileSync(join(SRC_DIR, 'public/public-catalog.service.ts'), 'utf8').split('\n');
    const queryPattern = /artwork\.(findMany|findFirst|count)\(/;

    const queryLines = lines.flatMap((line, index) => (queryPattern.test(line) ? [index] : []));
    expect(queryLines.length).toBeGreaterThan(0);

    const unguarded = queryLines.filter(
      (index) => !lines.slice(index, index + 7).some((line) => line.includes('publishedWhere(')),
    );
    expect(unguarded.map((index) => `line ${index + 1}`)).toEqual([]);
  });
});
