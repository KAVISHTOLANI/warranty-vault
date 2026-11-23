/** RFC 4180 CSV parsing and writing, shared by the CSV tools in this portfolio. */
export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  delimiter: string;
  issues: string[];
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const candidates = [',', ';', '\t', '|'];
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const counts = sample.split('\n').filter(Boolean).map((l) => splitLine(l, d).length);
    if (counts.length === 0) continue;
    const consistent = counts.every((c) => c === counts[0]);
    const score = (consistent ? 1000 : 0) + counts[0];
    if (counts[0] > 1 && score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function splitLine(line: string, d: string): string[] {
  return parseRecords(line, d)[0] ?? [];
}

function parseRecords(text: string, d: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') {
      quoted = true;
      i++;
    } else if (c === d) {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\n' || c === '\r') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}

export function parseCSV(input: string, opts: { delimiter?: string; header?: boolean } = {}): ParsedCSV {
  const text = input.replace(/^﻿/, '');
  const delimiter = opts.delimiter ?? detectDelimiter(text);
  const records = parseRecords(text, delimiter).filter((r) => !(r.length === 1 && r[0].trim() === ''));
  const issues: string[] = [];
  if (records.length === 0) return { headers: [], rows: [], delimiter, issues: ['The file is empty.'] };
  const useHeader = opts.header ?? true;
  let headers = useHeader ? records[0].map((h) => h.trim()) : records[0].map((_, i) => `Column ${i + 1}`);
  const body = useHeader ? records.slice(1) : records;
  const width = Math.max(headers.length, ...body.map((r) => r.length));
  if (width > headers.length) {
    issues.push(`Some rows have more values than there are headers; extra columns were named automatically.`);
    headers = [...headers, ...Array.from({ length: width - headers.length }, (_, i) => `Column ${headers.length + i + 1}`)];
  }
  const seen = new Map<string, number>();
  headers = headers.map((h, i) => {
    const base = h || `Column ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base} (${n + 1})` : base;
  });
  let short = 0;
  const rows = body.map((r) => {
    if (r.length < width) short++;
    return r.length < width ? [...r, ...Array(width - r.length).fill('')] : r;
  });
  if (short) issues.push(`${short} row${short === 1 ? ' was' : 's were'} shorter than the header and padded with empty values.`);
  if ((text.match(/"/g)?.length ?? 0) % 2 === 1) issues.push('The file has an unmatched quote character; some values may be merged.');
  return { headers, rows, delimiter, issues };
}

export function escapeField(v: string, d = ','): string {
  return /["\r\n]/.test(v) || v.includes(d) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCSV(headers: string[], rows: string[][], d = ','): string {
  return [headers, ...rows].map((r) => r.map((v) => escapeField(v ?? '', d)).join(d)).join('\r\n') + '\r\n';
}

export const DELIMITER_NAME: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };
