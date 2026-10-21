export type PageItem = number | 'gap';

const MAX_WITHOUT_GAPS = 7;

// Con pocas páginas se muestran todas; con más, primera, última y la actual con una vecina a cada lado
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= MAX_WITHOUT_GAPS) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items: PageItem[] = [];
  pages.forEach((page, i) => {
    const previous = pages[i - 1];
    if (previous !== undefined && page - previous > 1) {
      // Un hueco de una sola página se muestra completo en vez de una elipsis
      items.push(page - previous === 2 ? page - 1 : 'gap');
    }
    items.push(page);
  });
  return items;
}
