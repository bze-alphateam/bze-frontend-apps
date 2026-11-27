/** What a pager draws between its arrows: a page number, or "…" for the pages left out. */
export type PageItem = number | 'gap';

/** Up to this many pages every number is shown. */
const SHOW_ALL_UP_TO = 7;

/** How many pages `total` rows make; 0 rows is 0 pages. */
export const pageCount = (total: number, size: number): number => (total > 0 ? Math.ceil(total / size) : 0);

/**
 * The numbers of a pager: all of them up to 7 pages; with more, the first, the last and the
 * current page with its neighbours, a "…" for each run left out (1 … 4 5 6 … 12).
 */
export function pageItems(current: number, pages: number): PageItem[] {
    if (pages <= SHOW_ALL_UP_TO) return Array.from({length: pages}, (_, i) => i + 1);

    const shown = [...new Set([1, current - 1, current, current + 1, pages])]
        .filter((n) => n >= 1 && n <= pages)
        .sort((a, b) => a - b);
    const items: PageItem[] = [];
    shown.forEach((n, i) => {
        if (i > 0 && n - shown[i - 1] > 1) items.push('gap');
        items.push(n);
    });
    return items;
}

/** One page of an in-memory list (page 1 is the first). */
export function slicePage<T>(rows: T[], page: number, size: number): T[] {
    return rows.slice((page - 1) * size, page * size);
}

/** The page a view has to show: the asked one, held within 1..pages. */
export const clampPage = (page: number, pages: number): number => Math.min(Math.max(page, 1), Math.max(pages, 1));
