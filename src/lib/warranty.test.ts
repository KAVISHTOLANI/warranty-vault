import { describe, expect, it } from 'vitest';
import { coverageEnd, coverageUsed, csvRows, daysLeft, emptyDraft, expiryByMonth, parseBackup, status, summary, validateDraft, type Item } from './warranty';

const base: Item = {
  id: 'a',
  name: 'Kettle',
  brand: '',
  category: 'Appliance',
  retailer: '',
  purchaseDate: '2026-03-10',
  price: 40,
  coverage: 'months',
  months: 12,
  extraMonths: 0,
  serial: '',
  docs: { receipt: true, manual: false, card: false },
  docLocation: '',
  notes: '',
  claims: [],
};
const item = (p: Partial<Item>): Item => ({ ...base, ...p });

describe('coverage dates', () => {
  it('ends the day before the anniversary and adds extended cover', () => {
    expect(coverageEnd(base)).toBe('2027-03-09');
    expect(coverageEnd(item({ extraMonths: 24 }))).toBe('2029-03-09');
  });
  it('clamps month-end purchases', () => {
    expect(coverageEnd(item({ purchaseDate: '2026-01-31', months: 1 }))).toBe('2026-02-27');
  });
  it('has no end for lifetime or none', () => {
    expect(coverageEnd(item({ coverage: 'lifetime' }))).toBeNull();
    expect(coverageEnd(item({ coverage: 'none' }))).toBeNull();
  });
  it('counts days left including negative after expiry', () => {
    expect(daysLeft(base, '2027-03-09')).toBe(0);
    expect(daysLeft(base, '2027-03-12')).toBe(-3);
  });
});

describe('status', () => {
  it('classifies by the warning window', () => {
    expect(status(base, '2026-06-01', 60)).toBe('active');
    expect(status(base, '2027-01-08', 60)).toBe('expiring');
    expect(status(base, '2027-03-09', 60)).toBe('expiring');
    expect(status(base, '2027-03-10', 60)).toBe('expired');
    expect(status(item({ coverage: 'lifetime' }), '2090-01-01', 60)).toBe('lifetime');
    expect(status(item({ coverage: 'none' }), '2026-01-01', 60)).toBe('none');
  });
  it('reports coverage used', () => {
    expect(coverageUsed(base, '2026-03-10')).toBeCloseTo(1 / 365, 3);
    expect(coverageUsed(base, '2030-01-01')).toBe(1);
  });
});

describe('validation', () => {
  const today = '2026-11-23';
  it('requires a name and a past purchase date', () => {
    const r = validateDraft({ ...emptyDraft(today), purchaseDate: '2026-12-01' }, today);
    expect(r.errors.name).toMatch(/Name the product/);
    expect(r.errors.purchaseDate).toMatch(/future/);
    expect(r.value).toBeUndefined();
  });
  it('validates price and months', () => {
    const r = validateDraft({ ...emptyDraft(today), name: 'Drill', price: '-3', months: '1.5' }, today);
    expect(r.errors.price).toBeDefined();
    expect(r.errors.months).toBeDefined();
  });
  it('trims and rounds a valid draft; lifetime ignores months', () => {
    const r = validateDraft({ ...emptyDraft(today), name: '  Chair ', price: '199.999', coverage: 'lifetime', months: 'x' }, today);
    expect(r.value).toMatchObject({ name: 'Chair', price: 200, coverage: 'lifetime', months: 0 });
  });
});

describe('grouping, summary and export', () => {
  const today = '2026-11-23';
  const items = [
    item({ id: '1', purchaseDate: '2025-12-15' }), // ends 2026-12-14
    item({ id: '2', purchaseDate: '2026-01-02' }), // ends 2027-01-01
    item({ id: '3', purchaseDate: '2025-12-01' }), // ends 2026-11-30
    item({ id: '4', purchaseDate: '2024-01-01' }), // expired
    item({ id: '5', coverage: 'lifetime', price: 100, docs: { receipt: false, manual: false, card: false } }),
    item({ id: '6', coverage: 'none', price: 999 }),
  ];
  it('groups upcoming expiries by month, soonest first', () => {
    const g = expiryByMonth(items, today);
    expect(g.map((x) => x.month)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(g[0].list[0].item.id).toBe('3');
  });
  it('summarises counts, covered value and missing receipts', () => {
    const s = summary(items, today, 60);
    expect(s.counts).toEqual({ active: 0, expiring: 3, expired: 1, lifetime: 1, none: 1 });
    expect(s.coveredValue).toBe(220);
    expect(s.missingReceipt).toBe(1);
  });
  it('writes CSV rows with computed fields', () => {
    const [row] = csvRows([items[0]], today, 60);
    expect(row).toContain('2026-12-14');
    expect(row).toContain('Expiring soon');
    expect(row).toContain('40.00');
  });
});

describe('backup import', () => {
  it('rejects bad files with a reason', () => {
    expect(parseBackup('{').error).toMatch(/not valid JSON/);
    expect(parseBackup('{"x":1}').error).toMatch(/items/);
    expect(parseBackup('{"items":[{"name":"A","purchaseDate":"2026-02-30"}]}').error).toMatch(/invalid purchase date/);
  });
  it('fills defaults for missing optional fields', () => {
    const r = parseBackup(JSON.stringify({ items: [{ name: 'Lamp', purchaseDate: '2026-02-01', category: 'Weird' }] }));
    expect(r.items![0]).toMatchObject({ name: 'Lamp', category: 'Other', coverage: 'months', months: 12, claims: [] });
  });
});
