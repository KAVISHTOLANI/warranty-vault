import { useEffect, useMemo, useState, type ReactNode } from 'react';

/* Sortable, paginated tables shared by the wave 3 apps. */

export type SortDir = 'asc' | 'desc';
export interface Column<T> {
  key: string;
  label: string;
  /** Value used for sorting; strings compare case-insensitively, null/'' always sort last. */
  sort?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
  num?: boolean;
}

export function compareValues(a: string | number | null, b: string | number | null): number {
  const empty = (v: string | number | null) => v == null || v === '';
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

export function sortRows<T>(rows: T[], get: ((r: T) => string | number | null) | undefined, dir: SortDir): T[] {
  if (!get) return rows;
  const out = [...rows].sort((x, y) => {
    const a = get(x), b = get(y);
    const empty = (v: string | number | null) => v == null || v === '';
    if (empty(a) || empty(b)) return compareValues(a, b); // blanks last in both directions
    return dir === 'asc' ? compareValues(a, b) : compareValues(b, a);
  });
  return out;
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages, from: rows.length ? (p - 1) * size + 1 : 0, to: Math.min(p * size, rows.length) };
}

export function useTable<T>(rows: T[], columns: Column<T>[], opts: { initialSort?: string; initialDir?: SortDir; pageSize?: number } = {}) {
  const [sortKey, setSortKey] = useState(opts.initialSort ?? columns.find((c) => c.sort)?.key ?? '');
  const [dir, setDir] = useState<SortDir>(opts.initialDir ?? 'asc');
  const [page, setPage] = useState(1);
  const size = opts.pageSize ?? 10;
  const col = columns.find((c) => c.key === sortKey);
  const sorted = useMemo(() => sortRows(rows, col?.sort, dir), [rows, col, dir]);
  const paged = paginate(sorted, page, size);
  useEffect(() => setPage(1), [rows.length]);
  const toggle = (key: string) => {
    if (key === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setDir('asc');
    }
  };
  return { sortKey, dir, toggle, ...paged, total: rows.length, setPage };
}

export function DataTable<T>(props: {
  caption: string;
  columns: Column<T>[];
  table: ReturnType<typeof useTable<T>>;
  rowKey: (row: T) => string;
  empty?: ReactNode;
  captionHidden?: boolean;
}) {
  const { columns, table: t } = props;
  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="table">
          <caption className={props.captionHidden === false ? 'table-caption' : 'sr-only'}>{props.caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.num ? 'num' : undefined} aria-sort={c.sort ? (t.sortKey === c.key ? (t.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                  {c.sort ? (
                    <button type="button" className="sort-btn" onClick={() => t.toggle(c.key)}>
                      {c.label}
                      <span aria-hidden="true" className="sort-ind">{t.sortKey === c.key ? (t.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={props.rowKey(r)}>
                {columns.map((c, i) =>
                  i === 0 ? (
                    <th key={c.key} scope="row" className={c.num ? 'num' : undefined}>{c.render(r)}</th>
                  ) : (
                    <td key={c.key} className={c.num ? 'num' : undefined}>{c.render(r)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {t.total === 0 && <div className="table-empty">{props.empty ?? 'No rows match.'}</div>}
      </div>
      {t.total > 0 && <Pager table={t} />}
    </div>
  );
}

export function Pager({ table: t }: { table: { page: number; pages: number; from: number; to: number; total: number; setPage: (p: number) => void } }) {
  return (
    <nav className="pager row-between" aria-label="Pagination">
      <span className="small muted" aria-live="polite">
        Showing {t.from}–{t.to} of {t.total}
      </span>
      {t.pages > 1 && (
        <div className="row">
          <button type="button" className="btn btn-sm" disabled={t.page <= 1} onClick={() => t.setPage(t.page - 1)}>
            ← Previous
          </button>
          <span className="small">
            Page {t.page} of {t.pages}
          </span>
          <button type="button" className="btn btn-sm" disabled={t.page >= t.pages} onClick={() => t.setPage(t.page + 1)}>
            Next →
          </button>
        </div>
      )}
    </nav>
  );
}
