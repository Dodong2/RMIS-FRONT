/** Client-side page-based paging: the slice of `list` for `page` (clamped to the last page). */
export function pageOf<T>(list: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(page, 1), pageCount);
  return { rows: list.slice((current - 1) * size, current * size), page: current, pageCount };
}
