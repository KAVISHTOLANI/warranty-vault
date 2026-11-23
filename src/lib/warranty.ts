import { addDays, addMonths, daysBetween, isValidISODate } from '../shared/dates';

export type Coverage = 'months' | 'lifetime' | 'none';
export type Status = 'active' | 'expiring' | 'expired' | 'lifetime' | 'none';

export interface Claim {
  id: string;
  date: string;
  issue: string;
  outcome: 'open' | 'repaired' | 'replaced' | 'refunded' | 'rejected';
}

export interface Item {
  id: string;
  name: string;
  brand: string;
  category: string;
  retailer: string;
  purchaseDate: string;
  price: number | null;
  coverage: Coverage;
  months: number;
  /** Extra months from an extended plan, added after the manufacturer warranty. */
  extraMonths: number;
  serial: string;
  docs: { receipt: boolean; manual: boolean; card: boolean };
  docLocation: string;
  notes: string;
  claims: Claim[];
  demo?: boolean;
}

export const CATEGORIES = ['Appliance', 'Electronics', 'Computer', 'Furniture', 'Tools', 'Outdoor', 'Other'];
export const STATUS_LABEL: Record<Status, string> = {
  active: 'Covered',
  expiring: 'Expiring soon',
  expired: 'Expired',
  lifetime: 'Lifetime',
  none: 'No warranty',
};

/** Last covered day. Coverage starts on the purchase date, so a 12-month warranty bought 10 Mar ends 9 Mar next year. */
export function coverageEnd(item: Pick<Item, 'purchaseDate' | 'coverage' | 'months' | 'extraMonths'>): string | null {
  if (item.coverage !== 'months') return null;
  return addDays(addMonths(item.purchaseDate, item.months + (item.extraMonths || 0)), -1);
}

export function daysLeft(item: Item, today: string): number | null {
  const end = coverageEnd(item);
  return end == null ? null : daysBetween(today, end);
}

export function status(item: Item, today: string, warnDays: number): Status {
  if (item.coverage === 'none') return 'none';
  if (item.coverage === 'lifetime') return 'lifetime';
  const left = daysLeft(item, today)!;
  if (left < 0) return 'expired';
  if (left <= warnDays) return 'expiring';
  return 'active';
}

/** Share of the coverage window already used, 0–1. */
export function coverageUsed(item: Item, today: string): number | null {
  const end = coverageEnd(item);
  if (end == null) return null;
  const total = daysBetween(item.purchaseDate, end) + 1;
  const used = daysBetween(item.purchaseDate, today) + 1;
  return Math.min(1, Math.max(0, used / total));
}

export interface ItemDraft {
  name: string;
  brand: string;
  category: string;
  retailer: string;
  purchaseDate: string;
  price: string;
  coverage: Coverage;
  months: string;
  extraMonths: string;
  serial: string;
  docs: Item['docs'];
  docLocation: string;
  notes: string;
}

export const emptyDraft = (today: string): ItemDraft => ({
  name: '',
  brand: '',
  category: 'Appliance',
  retailer: '',
  purchaseDate: today,
  price: '',
  coverage: 'months',
  months: '12',
  extraMonths: '0',
  serial: '',
  docs: { receipt: false, manual: false, card: false },
  docLocation: '',
  notes: '',
});

export function draftFrom(item: Item): ItemDraft {
  return {
    ...item,
    price: item.price == null ? '' : String(item.price),
    months: String(item.months),
    extraMonths: String(item.extraMonths || 0),
  };
}

export type DraftErrors = Partial<Record<keyof ItemDraft, string>>;

export function validateDraft(d: ItemDraft, today: string): { errors: DraftErrors; value?: Omit<Item, 'id' | 'claims'> } {
  const errors: DraftErrors = {};
  if (!d.name.trim()) errors.name = 'Name the product so you can find it later.';
  else if (d.name.trim().length > 80) errors.name = 'Keep the name under 80 characters.';
  if (!isValidISODate(d.purchaseDate)) errors.purchaseDate = 'Enter the purchase date.';
  else if (d.purchaseDate > today) errors.purchaseDate = 'The purchase date can’t be in the future.';
  let price: number | null = null;
  if (d.price.trim()) {
    price = Number(d.price);
    if (!Number.isFinite(price) || price < 0) errors.price = 'Price must be a positive number, or leave it blank.';
  }
  const months = Number(d.months), extra = Number(d.extraMonths || 0);
  if (d.coverage === 'months') {
    if (!Number.isInteger(months) || months < 1 || months > 600) errors.months = 'Warranty length must be a whole number of months (1–600).';
    if (!Number.isInteger(extra) || extra < 0 || extra > 600) errors.extraMonths = 'Extended cover must be 0 or more whole months.';
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    value: {
      name: d.name.trim(),
      brand: d.brand.trim(),
      category: d.category,
      retailer: d.retailer.trim(),
      purchaseDate: d.purchaseDate,
      price: price == null ? null : Math.round(price * 100) / 100,
      coverage: d.coverage,
      months: d.coverage === 'months' ? months : 0,
      extraMonths: d.coverage === 'months' ? extra : 0,
      serial: d.serial.trim(),
      docs: d.docs,
      docLocation: d.docLocation.trim(),
      notes: d.notes.trim(),
    },
  };
}

/** Items whose coverage ends within the next `months` months, grouped by end month (YYYY-MM), soonest first. */
export function expiryByMonth(items: Item[], today: string, months = 12) {
  const horizon = addMonths(today, months);
  const groups = new Map<string, { item: Item; end: string }[]>();
  for (const item of items) {
    const end = coverageEnd(item);
    if (!end || end < today || end > horizon) continue;
    const k = end.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), { item, end }]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => ({ month, list: list.sort((a, b) => a.end.localeCompare(b.end)) }));
}

export function summary(items: Item[], today: string, warnDays: number) {
  const counts: Record<Status, number> = { active: 0, expiring: 0, expired: 0, lifetime: 0, none: 0 };
  let coveredValue = 0;
  for (const i of items) {
    const s = status(i, today, warnDays);
    counts[s]++;
    if ((s === 'active' || s === 'expiring' || s === 'lifetime') && i.price) coveredValue += i.price;
  }
  const missingReceipt = items.filter((i) => !i.docs.receipt && i.coverage !== 'none').length;
  return { counts, coveredValue: Math.round(coveredValue * 100) / 100, missingReceipt };
}

export const CSV_HEADERS = ['Name', 'Brand', 'Category', 'Retailer', 'Purchase date', 'Price', 'Coverage', 'Coverage ends', 'Status', 'Serial', 'Receipt kept', 'Documents stored at', 'Claims', 'Notes'];

export function csvRows(items: Item[], today: string, warnDays: number): string[][] {
  return items.map((i) => [
    i.name,
    i.brand,
    i.category,
    i.retailer,
    i.purchaseDate,
    i.price == null ? '' : i.price.toFixed(2),
    i.coverage === 'months' ? `${i.months + i.extraMonths} months` : i.coverage === 'lifetime' ? 'Lifetime' : 'None',
    coverageEnd(i) ?? '',
    STATUS_LABEL[status(i, today, warnDays)],
    i.serial,
    i.docs.receipt ? 'yes' : 'no',
    i.docLocation,
    String(i.claims.length),
    i.notes,
  ]);
}

/** Validates a JSON backup; returns items or a readable error. Unknown/missing optional fields get defaults. */
export function parseBackup(text: string): { items?: Item[]; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items;
  if (!Array.isArray(list)) return { error: 'Expected a Proofkeep backup with an "items" list.' };
  const items: Item[] = [];
  for (const [n, raw] of list.entries()) {
    const r = raw as Partial<Item>;
    if (!r || typeof r.name !== 'string' || !r.name.trim()) return { error: `Item ${n + 1} has no name.` };
    if (typeof r.purchaseDate !== 'string' || !isValidISODate(r.purchaseDate)) return { error: `“${r.name}” has an invalid purchase date.` };
    const coverage: Coverage = r.coverage === 'lifetime' || r.coverage === 'none' ? r.coverage : 'months';
    items.push({
      id: typeof r.id === 'string' ? r.id : `imp-${n}-${Date.now().toString(36)}`,
      name: r.name.trim(),
      brand: String(r.brand ?? ''),
      category: CATEGORIES.includes(String(r.category)) ? String(r.category) : 'Other',
      retailer: String(r.retailer ?? ''),
      purchaseDate: r.purchaseDate,
      price: typeof r.price === 'number' && r.price >= 0 ? r.price : null,
      coverage,
      months: coverage === 'months' && Number.isInteger(r.months) && r.months! > 0 ? r.months! : coverage === 'months' ? 12 : 0,
      extraMonths: Number.isInteger(r.extraMonths) && r.extraMonths! >= 0 ? r.extraMonths! : 0,
      serial: String(r.serial ?? ''),
      docs: { receipt: !!r.docs?.receipt, manual: !!r.docs?.manual, card: !!r.docs?.card },
      docLocation: String(r.docLocation ?? ''),
      notes: String(r.notes ?? ''),
      claims: Array.isArray(r.claims) ? r.claims.filter((c) => c && typeof c.issue === 'string' && isValidISODate(String(c.date))) : [],
    });
  }
  return { items };
}
