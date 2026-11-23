import { useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, downloadText, readFileText, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { DataTable, useTable, type Column } from './shared/table';
import { toCSV } from './shared/csv';
import { addDays, addMonths, daysBetween, formatDay, fromISO, relativeDays, todayISO } from './shared/dates';
import {
  CATEGORIES,
  CSV_HEADERS,
  STATUS_LABEL,
  coverageEnd,
  coverageUsed,
  csvRows,
  daysLeft,
  draftFrom,
  emptyDraft,
  expiryByMonth,
  parseBackup,
  status,
  summary,
  validateDraft,
  type Claim,
  type DraftErrors,
  type Item,
  type ItemDraft,
  type Status,
} from './lib/warranty';

const KEY = 'proofkeep:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/items', label: 'Items' },
  { to: '/calendar', label: 'Expiry calendar' },
  { to: '/add', label: 'Add item' },
];

interface Store {
  items: Item[];
  warnDays: number;
}

export function demoItems(today: string): Item[] {
  const ago = (months: number, days = 0) => addDays(addMonths(today, -months), -days);
  const d = (p: Partial<Item> & Pick<Item, 'id' | 'name' | 'purchaseDate'>): Item => ({
    brand: '',
    category: 'Appliance',
    retailer: '',
    price: null,
    coverage: 'months',
    months: 12,
    extraMonths: 0,
    serial: '',
    docs: { receipt: true, manual: false, card: false },
    docLocation: '',
    notes: '',
    claims: [],
    demo: true,
    ...p,
  });
  return [
    d({ id: 'demo-1', name: 'Washing machine', brand: 'Harrow & Pine', retailer: 'Demo Home Store', purchaseDate: ago(22, 10), price: 549, months: 24, serial: 'HP-WM-0042-DEMO', docs: { receipt: true, manual: true, card: true }, docLocation: 'Kitchen drawer folder, “Appliances”', notes: 'Drum bearing noise reported once; see claim.', claims: [{ id: 'c1', date: ago(5), issue: 'Loud drum noise on spin cycle', outcome: 'repaired' }] }),
    d({ id: 'demo-2', name: 'Laptop, 14-inch', brand: 'Tessel', category: 'Computer', retailer: 'Corner Electronics (demo)', purchaseDate: ago(10, 3), price: 1129, months: 12, extraMonths: 24, serial: 'TSL-14-88310', docs: { receipt: true, manual: false, card: true }, docLocation: 'Email folder “Purchases”, PDF invoice', notes: 'Extended plan adds 24 months after the manufacturer year.' }),
    d({ id: 'demo-3', name: 'Cordless drill', brand: 'Oakmere', category: 'Tools', retailer: 'Demo Hardware', purchaseDate: ago(35, 20), price: 89, months: 36, docs: { receipt: true, manual: true, card: false }, docLocation: 'Garage shelf box' }),
    d({ id: 'demo-4', name: 'Noise-cancelling headphones', brand: 'Brightwell', category: 'Electronics', retailer: 'Corner Electronics (demo)', purchaseDate: ago(13), price: 229, months: 12, docs: { receipt: false, manual: false, card: false }, notes: 'Receipt not found yet — check the card statement.' }),
    d({ id: 'demo-5', name: 'Office chair', brand: 'Oakmere', category: 'Furniture', retailer: 'Demo Furniture Co.', purchaseDate: ago(18), price: 310, months: 60, docs: { receipt: true, manual: true, card: true }, docLocation: 'Scanned to the “Home” cloud folder' }),
    d({ id: 'demo-6', name: 'Electric kettle', brand: 'Brightwell', retailer: 'Demo Home Store', purchaseDate: ago(2), price: 35, months: 24 }),
    d({ id: 'demo-7', name: 'Cast-iron casserole dish', brand: 'Harrow & Pine', category: 'Other', retailer: 'Demo Kitchen Shop', purchaseDate: ago(40), price: 120, coverage: 'lifetime', months: 0, docs: { receipt: true, manual: false, card: true } }),
    d({ id: 'demo-8', name: 'Robot vacuum with self-emptying dock and replacement brush set', brand: 'Tessel', retailer: 'Demo Home Store', purchaseDate: ago(11, 15), price: 399, months: 12, serial: 'TSL-RV-2210', notes: 'A long product name, to show how it wraps.', claims: [{ id: 'c2', date: ago(1), issue: 'Dock no longer empties the bin', outcome: 'open' }] }),
    d({ id: 'demo-9', name: 'Garden hose reel', category: 'Outdoor', retailer: 'Demo Hardware', purchaseDate: ago(6), price: 45, coverage: 'none', months: 0, docs: { receipt: false, manual: false, card: false } }),
    d({ id: 'demo-10', name: 'Microwave oven', brand: 'Brightwell', retailer: 'Demo Home Store', purchaseDate: ago(26), price: 159, months: 24, docs: { receipt: true, manual: true, card: false } }),
    d({ id: 'demo-11', name: 'Tablet', brand: 'Tessel', category: 'Electronics', retailer: 'Corner Electronics (demo)', purchaseDate: ago(4), price: 349, months: 12 }),
  ];
}

const demoStore = (): Store => ({ items: demoItems(todayISO()), warnDays: 60 });
const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });
const BADGE: Record<Status, string> = { active: 'badge-ok', expiring: 'badge-warn', expired: 'badge-err', lifetime: 'badge-accent', none: '' };

function StatusBadge({ s }: { s: Status }) {
  return <span className={`badge ${BADGE[s]}`}>{STATUS_LABEL[s]}</span>;
}

export default function App() {
  const [route, navigate] = useRoute();
  const [store, setStore] = usePersistentState<Store>(KEY, demoStore);
  const today = todayISO();
  const ctx = { store, setStore, today, navigate };
  const item = route.match(/^\/item\/(.+)$/);
  const edit = route.match(/^\/edit\/(.+)$/);

  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/items') page = <Items {...ctx} />;
  else if (route === '/add') page = <Editor {...ctx} />;
  else if (edit) page = <Editor {...ctx} id={edit[1]} />;
  else if (item) page = <Detail {...ctx} id={item[1]} />;
  else if (route === '/calendar') page = <Calendar {...ctx} />;
  else page = <NotFound />;

  return (
    <Shell name="Proofkeep" wordmark={['Proof', 'keep']} nav={NAV} route={route} cta={{ to: '/add', label: 'Add an item' }} footerNote="Records stay in this browser. Proofkeep is an organiser, not legal or consumer advice.">
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store) => void; today: string; navigate: (to: string) => void };

/* ---------- Coverage timeline chart ---------- */
export function Timeline({ items, today, warnDays, limit }: { items: Item[]; today: string; warnDays: number; limit?: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rows = items
    .filter((i) => i.coverage !== 'none')
    .sort((a, b) => (coverageEnd(a) ?? '9999').localeCompare(coverageEnd(b) ?? '9999'))
    .slice(0, limit);
  if (rows.length === 0) return <p className="muted small">No items with a warranty to chart yet.</p>;
  const start = rows.reduce((m, i) => (i.purchaseDate < m ? i.purchaseDate : m), today).slice(0, 4) + '-01-01';
  const lastEnd = rows.reduce((m, i) => { const e = coverageEnd(i); return e && e > m ? e : m; }, addMonths(today, 12));
  const end = `${Number(lastEnd.slice(0, 4)) + 1}-01-01`;
  const span = daysBetween(start, end);
  const pct = (iso: string) => (daysBetween(start, iso) / span) * 100;
  const years: string[] = [];
  for (let y = Number(start.slice(0, 4)); y < Number(end.slice(0, 4)); y++) years.push(String(y));
  const step = Math.ceil(years.length / 5); // keep axis labels readable on narrow screens

  const show = (e: React.MouseEvent | React.FocusEvent, text: string) => {
    const box = wrap.current!.getBoundingClientRect();
    const t = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({ x: t.left - box.left + t.width / 2, y: t.top - box.top, text });
  };

  return (
    <figure className="timeline-fig">
      <div className="timeline" ref={wrap} onMouseLeave={() => setTip(null)}>
        <div className="tl-axis" aria-hidden="true">
          <span className="tl-label" />
          <div className="tl-track">
            {years.map((y, n) => n % step === 0 && (
              <span key={y} className="tl-year" style={{ left: `${pct(`${y}-01-01`)}%` }}>{y}</span>
            ))}
          </div>
        </div>
        <ul className="tl-rows">
          {rows.map((i, n) => {
            const e = coverageEnd(i);
            const s = status(i, today, warnDays);
            const left = pct(i.purchaseDate);
            const width = e ? Math.max(pct(e) - left, 0.6) : 100 - left;
            const text = `${i.name}: ${formatDay(i.purchaseDate)} → ${e ? formatDay(e) : 'lifetime'} (${STATUS_LABEL[s].toLowerCase()})`;
            return (
              <li key={i.id} className="tl-row" style={{ ['--i' as string]: n }}>
                <span className="tl-label" title={i.name}>{i.name}</span>
                <div className="tl-track">
                  {years.map((y) => <i key={y} className="tl-grid" style={{ left: `${pct(`${y}-01-01`)}%` }} />)}
                  <span
                    className={`tl-bar s-${s}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    tabIndex={0}
                    role="img"
                    aria-label={text}
                    onMouseEnter={(ev) => show(ev, text)}
                    onFocus={(ev) => show(ev, text)}
                    onBlur={() => setTip(null)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="tl-today" style={{ ['--xf' as string]: String(pct(today) / 100) }} aria-hidden="true" />
        {tip && <span className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>}
      </div>
      <figcaption className="legend">
        <span><i className="s-active" />Covered</span>
        <span><i className="s-expiring" />Expiring within {warnDays} days</span>
        <span><i className="s-expired" />Expired</span>
        <span><i className="s-lifetime" />Lifetime</span>
        <span><i className="today-key" />Today</span>
        <span className="muted">· each bar runs from purchase to the last covered day</span>
      </figcaption>
    </figure>
  );
}

function HeroPreview() {
  const today = todayISO();
  const items = demoItems(today);
  const s = summary(items, today, 60);
  return (
    <div className="hero-pk">
      <div className="hero-pk-stats">
        <div><b>{s.counts.active + s.counts.lifetime}</b><span>covered</span></div>
        <div><b>{s.counts.expiring}</b><span>expiring in 60 days</span></div>
        <div><b>{s.counts.expired}</b><span>expired</span></div>
      </div>
      <Timeline items={items} today={today} warnDays={60} limit={6} />
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Warranty & purchase records"
      title={<>Know what’s covered <em>before it breaks.</em></>}
      lead="Record what you bought, when, and for how long it’s covered. Proofkeep works out each warranty’s last day, warns you before it lapses, and keeps the claim history and receipt location next to it."
      primary={{ href: '#/items', label: 'Open your items' }}
      secondary={{ href: '#/calendar', label: 'See the expiry calendar' }}
      previewLabel="Coverage timeline — demo items"
      preview={<HeroPreview />}
      steps={[
        { title: 'Add a purchase', body: 'Product, date, price and warranty length — plus any extended plan, which is added after the manufacturer cover.' },
        { title: 'Note the proof', body: 'Tick which documents you kept and write down where they are, so a claim never starts with a search.' },
        { title: 'Watch the window', body: 'Items move to “Expiring soon” inside your warning window, and the calendar lists every end date month by month.' },
      ]}
      stepsIntro="Proofkeep opens with eleven labelled demo items. Clear them from the Items page whenever you are ready to add your own."
      features={[
        { title: 'Exact end dates', body: 'A 12-month warranty bought on 10 March covers up to 9 March next year. Month-end purchases are handled correctly.' },
        { title: 'Claims log', body: 'Record each fault, the date you reported it and how it was resolved.' },
        { title: 'Missing paperwork', body: 'See which covered items have no receipt on file — the usual reason a claim is refused.' },
        { title: 'Portable', body: 'Export a CSV for a spreadsheet or a JSON backup you can import on another browser.' },
      ]}
      note="Warranty terms vary. Proofkeep calculates dates from what you enter; check the actual terms before relying on them."
      closing={{ title: <>Start with the <em>most expensive</em> thing you own.</>, action: { href: '#/add', label: 'Add an item' } }}
    />
  );
}

/* ---------- Items ---------- */
function Items({ store, setStore, today }: Ctx) {
  const [flash, setFlash] = useFlash(5000);
  const [q, setQ] = useState('');
  const [st, setSt] = useState<'all' | Status>('all');
  const [cat, setCat] = useState('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const { items, warnDays } = store;
  const s = summary(items, today, warnDays);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (st === 'all' || status(i, today, warnDays) === st) &&
        (cat === 'all' || i.category === cat) &&
        (!needle || [i.name, i.brand, i.retailer, i.serial, i.notes].join(' ').toLowerCase().includes(needle)),
    );
  }, [items, q, st, cat, today, warnDays]);

  const columns: Column<Item>[] = [
    { key: 'name', label: 'Item', sort: (i) => i.name, render: (i) => <><a href={`#/item/${i.id}`}>{i.name}</a>{i.demo && <> <DemoTag /></>}{i.brand && <div className="small muted">{i.brand}</div>}</> },
    { key: 'cat', label: 'Category', sort: (i) => i.category, render: (i) => i.category },
    { key: 'bought', label: 'Purchased', sort: (i) => i.purchaseDate, render: (i) => formatDay(i.purchaseDate) },
    { key: 'ends', label: 'Covered until', sort: (i) => coverageEnd(i) ?? (i.coverage === 'lifetime' ? '9999' : ''), render: (i) => (i.coverage === 'lifetime' ? 'Lifetime' : coverageEnd(i) ? formatDay(coverageEnd(i)!) : '—') },
    { key: 'left', label: 'Days left', num: true, sort: (i) => daysLeft(i, today), render: (i) => { const l = daysLeft(i, today); return l == null ? '—' : l < 0 ? <span className="muted">{-l} ago</span> : l; } },
    { key: 'status', label: 'Status', sort: (i) => ['expiring', 'active', 'lifetime', 'expired', 'none'].indexOf(status(i, today, warnDays)), render: (i) => <StatusBadge s={status(i, today, warnDays)} /> },
    { key: 'price', label: 'Price', num: true, sort: (i) => i.price, render: (i) => (i.price == null ? '—' : money(i.price)) },
  ];
  const table = useTable(filtered, columns, { initialSort: 'ends', pageSize: 8 });
  const hasDemo = items.some((i) => i.demo);

  async function onImport(file: File | undefined) {
    if (!file) return;
    const r = parseBackup(await readFileText(file));
    if (fileRef.current) fileRef.current.value = '';
    if (r.error) return setFlash({ kind: 'error', text: `Import failed: ${r.error} Your items were not changed.` });
    setStore({ ...store, items: r.items! });
    setFlash({ kind: 'success', text: `Imported ${r.items!.length} item${r.items!.length === 1 ? '' : 's'} from the backup.` });
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow="Items"
        title={<>Everything you’ve <em>kept proof of.</em></>}
        description={`Warning window: ${warnDays} days. Change it on the expiry calendar.`}
        actions={<a className="btn btn-primary" href="#/add">Add item</a>}
      />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          actions={<><a className="btn btn-primary" href="#/add">Add your first item</a><button type="button" className="btn" onClick={() => setStore({ ...store, items: demoItems(today) })}>Load demo items</button></>}
        >
          Add a purchase with its warranty length and Proofkeep will work out when coverage ends.
        </EmptyState>
      ) : (
        <>
          <div className="stats" data-testid="summary">
            <div className="stat"><span className="stat-label">Covered</span><span className="stat-value">{s.counts.active + s.counts.lifetime}</span></div>
            <div className="stat"><span className="stat-label">Expiring soon</span><span className="stat-value">{s.counts.expiring}</span></div>
            <div className="stat"><span className="stat-label">Expired</span><span className="stat-value">{s.counts.expired}</span></div>
            <div className="stat"><span className="stat-label">Value still covered</span><span className="stat-value">{money(s.coveredValue)}</span></div>
          </div>
          {s.missingReceipt > 0 && (
            <Notice kind="warn">
              {s.missingReceipt} covered item{s.missingReceipt === 1 ? ' has' : 's have'} no receipt on file. Without proof of purchase most warranty claims are refused — they are marked “No receipt” below.
            </Notice>
          )}
          <div className="card stack">
            <div className="filters">
              <Field label="Search" className="grow">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, brand, retailer, serial or note" />}</Field>
              <Field label="Status">
                {(p) => (
                  <select {...p} value={st} onChange={(e) => setSt(e.target.value as typeof st)}>
                    <option value="all">All statuses</option>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Category">
                {(p) => (
                  <select {...p} value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="all">All categories</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <DataTable
              caption="Items with warranty status"
              columns={[...columns.slice(0, 1).map((c) => ({ ...c, render: (i: Item) => <>{c.render(i)}{!i.docs.receipt && i.coverage !== 'none' && <div><span className="badge badge-warn">No receipt</span></div>}</> })), ...columns.slice(1)]}
              table={table}
              rowKey={(i) => i.id}
              empty={<>No items match these filters. <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setSt('all'); setCat('all'); }}>Clear filters</button></>}
            />
          </div>
        </>
      )}
      <div className="card stack">
        <h2 className="h3">Export & backup</h2>
        <div className="row">
          <button type="button" className="btn" disabled={!items.length} onClick={() => downloadText('proofkeep-items.csv', toCSV(CSV_HEADERS, csvRows(items, today, warnDays)), 'text/csv')}>Export CSV</button>
          <button type="button" className="btn" disabled={!items.length} onClick={() => downloadText('proofkeep-backup.json', JSON.stringify({ app: 'proofkeep', version: 1, items }, null, 2), 'application/json')}>Download JSON backup</button>
          <label className="btn">
            Import JSON backup
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onImport(e.target.files?.[0])} />
          </label>
          {hasDemo && (
            <button type="button" className="btn btn-ghost" onClick={() => { setStore({ ...store, items: items.filter((i) => !i.demo) }); setFlash({ kind: 'success', text: 'Demo items removed. Your own items were kept.' }); }}>
              Clear demo items
            </button>
          )}
        </div>
        <p className="small muted">Importing a backup replaces the items in this browser. Invalid files are rejected and nothing changes.</p>
      </div>
    </div>
  );
}

/* ---------- Add / edit ---------- */
function Editor({ store, setStore, today, navigate, id }: Ctx & { id?: string }) {
  const existing = id ? store.items.find((i) => i.id === id) : undefined;
  const [draft, setDraft] = useState<ItemDraft>(() => (existing ? draftFrom(existing) : emptyDraft(today)));
  const [submitted, setSubmitted] = useState(false);
  const errors: DraftErrors = submitted ? validateDraft(draft, today).errors : {}; // live once the user has tried to save
  if (id && !existing) return <EmptyState title="Item not found" actions={<a className="btn btn-primary" href="#/items">Back to items</a>}>It may have been deleted.</EmptyState>;
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setDraft({ ...draft, [k]: v });
  const preview = validateDraft(draft, today).value;
  const previewEnd = preview ? coverageEnd(preview) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = validateDraft(draft, today);
    setSubmitted(true);
    if (!r.value) {
      const first = Object.keys(r.errors)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select`)?.focus();
      return;
    }
    if (existing) {
      setStore({ ...store, items: store.items.map((i) => (i.id === existing.id ? { ...existing, ...r.value!, demo: false } : i)) });
      navigate(`/item/${existing.id}`);
    } else {
      const nid = uid('item');
      setStore({ ...store, items: [{ ...r.value, id: nid, claims: [] }, ...store.items] });
      navigate(`/item/${nid}?saved`);
    }
  }

  return (
    <div className="stack">
      <PageHead eyebrow={existing ? 'Edit item' : 'Add item'} title={existing ? <>Edit <em>{existing.name}</em></> : <>Record a <em>purchase.</em></>} description="Only the name and purchase date are required. Everything else makes a future claim easier." />
      <form className="layout-main" onSubmit={submit} noValidate>
        <div className="card stack">
          {Object.keys(errors).length > 0 && <Notice kind="error">Please fix {Object.keys(errors).length === 1 ? 'the highlighted field' : `the ${Object.keys(errors).length} highlighted fields`}.</Notice>}
          <div className="form-grid">
            <div data-field="name"><Field label="Product name" error={errors.name}>{(p) => <input {...p} value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />}</Field></div>
            <Field label="Brand">{(p) => <input {...p} value={draft.brand} onChange={(e) => set('brand', e.target.value)} />}</Field>
            <Field label="Category">{(p) => <select {...p} value={draft.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            <Field label="Retailer">{(p) => <input {...p} value={draft.retailer} onChange={(e) => set('retailer', e.target.value)} />}</Field>
            <div data-field="purchaseDate"><Field label="Purchase date" error={errors.purchaseDate}>{(p) => <input {...p} type="date" max={today} value={draft.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />}</Field></div>
            <div data-field="price"><Field label="Price paid" hint="Optional" error={errors.price}>{(p) => <input {...p} inputMode="decimal" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />}</Field></div>
          </div>
          <fieldset className="stack">
            <legend className="label">Warranty</legend>
            <div className="tabs" role="radiogroup" aria-label="Warranty type">
              {([['months', 'Fixed length'], ['lifetime', 'Lifetime'], ['none', 'No warranty']] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={draft.coverage === v} onClick={() => set('coverage', v)}>{l}</button>
              ))}
            </div>
            {draft.coverage === 'months' && (
              <div className="form-grid">
                <div data-field="months"><Field label="Manufacturer warranty (months)" error={errors.months}>{(p) => <input {...p} inputMode="numeric" value={draft.months} onChange={(e) => set('months', e.target.value)} />}</Field></div>
                <div data-field="extraMonths"><Field label="Extended plan (extra months)" hint="Added after the manufacturer warranty" error={errors.extraMonths}>{(p) => <input {...p} inputMode="numeric" value={draft.extraMonths} onChange={(e) => set('extraMonths', e.target.value)} />}</Field></div>
              </div>
            )}
          </fieldset>
          <div className="form-grid">
            <Field label="Serial number">{(p) => <input {...p} className="mono" value={draft.serial} onChange={(e) => set('serial', e.target.value)} />}</Field>
            <Field label="Where the documents are" hint="A drawer, a folder, an email label…">{(p) => <input {...p} value={draft.docLocation} onChange={(e) => set('docLocation', e.target.value)} />}</Field>
          </div>
          <fieldset>
            <legend className="label">Documents kept</legend>
            <div className="row">
              {([['receipt', 'Receipt or invoice'], ['manual', 'Manual'], ['card', 'Warranty card']] as const).map(([k, l]) => (
                <label key={k} className="check"><input type="checkbox" checked={draft.docs[k]} onChange={(e) => set('docs', { ...draft.docs, [k]: e.target.checked })} /> {l}</label>
              ))}
            </div>
          </fieldset>
          <Field label="Notes">{(p) => <textarea {...p} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
          <div className="row">
            <button className="btn btn-primary" type="submit">{existing ? 'Save changes' : 'Save item'}</button>
            <a className="btn btn-ghost" href={existing ? `#/item/${existing.id}` : '#/items'}>Cancel</a>
          </div>
        </div>
        <aside className="card stack" aria-live="polite">
          <p className="eyebrow">Coverage preview</p>
          {draft.coverage === 'none' ? <p>No warranty — the item is kept for your records only.</p>
            : draft.coverage === 'lifetime' ? <p>Lifetime cover from {preview ? formatDay(preview.purchaseDate) : 'the purchase date'}.</p>
            : previewEnd ? (
              <>
                <p className="display-num">{formatDay(previewEnd)}</p>
                <p className="small muted">Last covered day — {relativeDays(daysBetween(today, previewEnd))}. Coverage begins on the purchase date.</p>
              </>
            ) : <p className="muted">Enter a name, purchase date and length to see the end date.</p>}
        </aside>
      </form>
    </div>
  );
}

/* ---------- Detail ---------- */
function Detail({ store, setStore, today, navigate, id }: Ctx & { id: string }) {
  const realId = id.replace(/\?.*$/, '');
  const justSaved = id.includes('?saved');
  const item = store.items.find((i) => i.id === realId);
  const [flash, setFlash] = useFlash(5000);
  const [claim, setClaim] = useState({ date: today, issue: '' });
  const [claimErr, setClaimErr] = useState<string | null>(null);
  if (!item) return <EmptyState title="Item not found" actions={<a className="btn btn-primary" href="#/items">Back to items</a>}>It may have been deleted, or the link is out of date.</EmptyState>;
  const s = status(item, today, store.warnDays);
  const end = coverageEnd(item);
  const used = coverageUsed(item, today);
  const left = daysLeft(item, today);
  const update = (patch: Partial<Item>) => setStore({ ...store, items: store.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) });

  function addClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claim.issue.trim()) return setClaimErr('Describe the fault or issue.');
    if (claim.date > today) return setClaimErr('The claim date can’t be in the future.');
    if (claim.date < item!.purchaseDate) return setClaimErr('The claim date is before the purchase date.');
    setClaimErr(null);
    update({ claims: [...item!.claims, { id: uid('claim'), date: claim.date, issue: claim.issue.trim(), outcome: 'open' as const }].sort((a, b) => b.date.localeCompare(a.date)) });
    setClaim({ date: today, issue: '' });
    setFlash({ kind: 'success', text: 'Claim added to the log.' });
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow={<><a href="#/items">Items</a> / {item.category}</>}
        title={item.name}
        description={[item.brand, item.retailer && `bought from ${item.retailer}`].filter(Boolean).join(', ') || undefined}
        actions={<><a className="btn" href={`#/edit/${item.id}`}>Edit</a><button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Delete “${item.name}” and its claims log?`)) { setStore({ ...store, items: store.items.filter((i) => i.id !== item.id) }); navigate('/items'); } }}>Delete</button></>}
      />
      {justSaved && <Notice kind="success">Saved “{item.name}”.</Notice>}
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {item.demo && <p><DemoTag /> <span className="small muted">This is a fictional demo item.</span></p>}
      <div className="grid-2">
        <section className="card stack" aria-labelledby="cov-title">
          <div className="card-title-row"><h2 id="cov-title" className="h3">Coverage</h2><StatusBadge s={s} /></div>
          {end && used != null ? (
            <>
              <p className="display-num" data-testid="days-left">{left! >= 0 ? `${left} days left` : `Expired ${-left!} days ago`}</p>
              <div className="progress" role="progressbar" aria-label="Share of coverage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}>
                <span style={{ width: `${used * 100}%` }} />
              </div>
              <div className="row-between small muted"><span>Bought {formatDay(item.purchaseDate)}</span><span>Covered until {formatDay(end)}</span></div>
              <p className="small">
                {item.months} month{item.months === 1 ? '' : 's'} manufacturer warranty{item.extraMonths ? ` + ${item.extraMonths} months extended plan` : ''}.
              </p>
            </>
          ) : (
            <p>{item.coverage === 'lifetime' ? 'Lifetime warranty — no end date.' : 'No warranty recorded for this item.'}</p>
          )}
        </section>
        <section className="card stack" aria-labelledby="facts-title">
          <h2 id="facts-title" className="h3">Purchase details</h2>
          <dl className="facts">
            <dt>Purchased</dt><dd>{formatDay(item.purchaseDate)}</dd>
            <dt>Price</dt><dd>{item.price == null ? '—' : money(item.price)}</dd>
            <dt>Serial</dt><dd className="mono">{item.serial || '—'}</dd>
            <dt>Documents at</dt><dd>{item.docLocation || <span className="muted">Not noted</span>}</dd>
          </dl>
          <ul className="doc-list" aria-label="Documents kept">
            {([['receipt', 'Receipt or invoice'], ['manual', 'Manual'], ['card', 'Warranty card']] as const).map(([k, l]) => (
              <li key={k} className={item.docs[k] ? 'yes' : 'no'}>
                <label className="check"><input type="checkbox" checked={item.docs[k]} onChange={(e) => update({ docs: { ...item.docs, [k]: e.target.checked } })} /> {l}</label>
              </li>
            ))}
          </ul>
          {item.notes && <p className="note-box">{item.notes}</p>}
        </section>
      </div>
      <section className="card stack" aria-labelledby="claims-title">
        <h2 id="claims-title" className="h3">Claims log</h2>
        {item.claims.length === 0 ? <p className="muted">No claims recorded. If something goes wrong, log the date you reported it here.</p> : (
          <ul className="list claims">
            {item.claims.map((c) => (
              <li key={c.id} className="row-between">
                <div><strong>{c.issue}</strong><div className="small muted">Reported {formatDay(c.date)}{end && c.date > end ? ' · after coverage ended' : ''}</div></div>
                <label className="claim-outcome">
                  <span className="sr-only">Outcome for “{c.issue}”</span>
                  <select value={c.outcome} onChange={(e) => update({ claims: item.claims.map((x) => (x.id === c.id ? { ...x, outcome: e.target.value as Claim['outcome'] } : x)) })}>
                    {['open', 'repaired', 'replaced', 'refunded', 'rejected'].map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
        <form className="filters" onSubmit={addClaim} noValidate>
          <Field label="Date reported">{(p) => <input {...p} type="date" max={today} value={claim.date} onChange={(e) => setClaim({ ...claim, date: e.target.value })} />}</Field>
          <Field label="Issue" className="grow" error={claimErr}>{(p) => <input {...p} value={claim.issue} onChange={(e) => setClaim({ ...claim, issue: e.target.value })} placeholder="What went wrong?" />}</Field>
          <button className="btn btn-primary" type="submit">Log claim</button>
        </form>
      </section>
    </div>
  );
}

/* ---------- Calendar ---------- */
function Calendar({ store, setStore, today }: Ctx) {
  const groups = expiryByMonth(store.items, today, 12);
  const monthName = (ym: string) => fromISO(`${ym}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <div className="stack">
      <PageHead eyebrow="Expiry calendar" title={<>What runs out <em>in the next year.</em></>} description="Every warranty that ends in the next 12 months, grouped by month." />
      <div className="card row-between">
        <Field label="Warn me this many days before coverage ends" hint="Items inside this window show as “Expiring soon”.">
          {(p) => (
            <select {...p} value={store.warnDays} onChange={(e) => setStore({ ...store, warnDays: Number(e.target.value) })}>
              {[14, 30, 60, 90, 120].map((n) => <option key={n} value={n}>{n} days</option>)}
            </select>
          )}
        </Field>
      </div>
      {store.items.length > 0 && (
        <section className="card stack" aria-labelledby="tl-title">
          <h2 id="tl-title" className="h3">Coverage timeline</h2>
          <Timeline items={store.items} today={today} warnDays={store.warnDays} />
        </section>
      )}
      {groups.length === 0 ? (
        <EmptyState title="Nothing expires in the next 12 months" actions={<a className="btn" href="#/items">View all items</a>}>Items with lifetime cover or no warranty never appear here.</EmptyState>
      ) : (
        <ol className="months">
          {groups.map((g) => (
            <li key={g.month} className="card stack" data-reveal>
              <h2 className="h3">{monthName(g.month)} <span className="muted small">· {g.list.length} item{g.list.length === 1 ? '' : 's'}</span></h2>
              <ul className="list">
                {g.list.map(({ item, end }) => (
                  <li key={item.id} className="row-between">
                    <span><a href={`#/item/${item.id}`}>{item.name}</a>{!item.docs.receipt && <> <span className="badge badge-warn">No receipt</span></>}</span>
                    <span className="small"><strong>{formatDay(end, { day: 'numeric', month: 'short' })}</strong> · {relativeDays(daysBetween(today, end))}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
