// Minimal, dependency-free CSV parsing + building (RFC4180-ish).
// Handles quoted fields, embedded commas/newlines/quotes, BOM, CRLF.

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse a CSV with a header row into objects keyed by normalized header. */
export function parseCsvTable(text: string): CsvTable {
  const raw = parseCsv(text);
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = raw[0].map((h) => h.trim());
  const rows = raw.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return lines.join("\n");
}

/** Parse 'YYYY-MM-DD' or 'DD/MM/YYYY' or 'YYYY/MM/DD' → 'YYYY-MM-DD'. */
export function parseDateCell(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Parse 'YYYY-MM' or 'MM/YYYY' or 'YYYY/MM' → 'YYYY-MM'. */
export function parseMonthCell(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{4})$/); // MM/YYYY
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = v.match(/^(\d{4})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return null;
}

export function parseNumberCell(value: string): number | null {
  const v = value.replace(/[, EGP%\s]/gi, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
