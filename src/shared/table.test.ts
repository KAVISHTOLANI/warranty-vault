import { describe, expect, it } from 'vitest';
import { compareValues, paginate, sortRows } from './table';

describe('table helpers', () => {
  it('sorts numbers, strings and blanks (blanks last both ways)', () => {
    const rows = [{ v: 'b' }, { v: '' }, { v: 'A' }, { v: 'c10' }, { v: 'c9' }];
    expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v)).toEqual(['A', 'b', 'c9', 'c10', '']);
    expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual(['c10', 'c9', 'b', 'A', '']);
    expect(compareValues(2, 10)).toBeLessThan(0);
  });
  it('paginates and clamps the page', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(rows, 3, 10)).toMatchObject({ rows: [20, 21, 22], page: 3, pages: 3, from: 21, to: 23 });
    expect(paginate(rows, 9, 10).page).toBe(3);
    expect(paginate([], 1, 10)).toMatchObject({ pages: 1, from: 0, to: 0 });
  });
});
