// Date / working-day / formatting helpers.
//
// SLA gap resolution (documented in docs/PRD-GAPS.md): "T-3 working days"
// is interpreted as "must complete by the date 3 working days BEFORE launch".
// Egypt weekend = Friday & Saturday, so working days are Sunday–Thursday.
// After 5 working days past the T-3 deadline the card escalates to Locked Out.

export const WEEKEND_DAYS = [5, 6]; // Fri, Sat (Egypt)

export function isWorkingDay(d: Date): boolean {
  return !WEEKEND_DAYS.includes(d.getDay());
}

export function parseDate(iso: string): Date {
  // 'YYYY-MM-DD' or full ISO — normalize to a local-midnight date for day math.
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Add n working days (skips Fri/Sat). n may be negative. */
export function addWorkingDays(d: Date, n: number): Date {
  const copy = new Date(d);
  let remaining = Math.abs(n);
  const step = n < 0 ? -1 : 1;
  while (remaining > 0) {
    copy.setDate(copy.getDate() + step);
    if (isWorkingDay(copy)) remaining--;
  }
  return copy;
}

/** Working days between two dates (a → b, exclusive of a, inclusive of b). Negative if b < a. */
export function workingDaysBetween(a: Date, b: Date): number {
  if (b.getTime() < a.getTime()) return -workingDaysBetween(b, a);
  let count = 0;
  const cursor = new Date(a);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= b.getTime()) {
    if (isWorkingDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function todayIso(): string {
  return toIsoDay(today());
}

/** 'YYYY-MM' for a given ISO date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseDate(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtEgp(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (
    new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(value) + " EGP"
  );
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Arabic text search folding: alef variants → ا, ta marbuta → ه, alif maqsura → ي, strip tashkeel. */
export function foldArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670]/g, "") // tashkeel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();
}

export function matchesSearch(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  return foldArabic(haystack).includes(foldArabic(query));
}
