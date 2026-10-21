import { BRAND } from './brand.config';

describe('BRAND', () => {
  it('defines every expected key with a non-empty value', () => {
    const keys = [
      'name',
      'heroTitle',
      'heroSubtitle',
      'commissionTitle',
      'commissionText',
      'footerNote',
      'credits',
      'githubUrl',
      'githubLabel',
    ] as const;
    for (const key of keys) {
      expect(BRAND[key].length).toBeGreaterThan(0);
    }
  });

  it('uses an https GitHub URL', () => {
    expect(BRAND.githubUrl.startsWith('https://github.com/')).toBe(true);
  });
});
