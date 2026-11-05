// Campaign domain logic: stock readiness, SLA flags, board summaries.

import type {
  CampaignRow,
  StockRow,
  Depot,
  StockReadiness,
  Stage,
} from "./types";
import { DEPOTS, STAGE_LABELS } from "./types";
import {
  addWorkingDays,
  monthOf,
  parseDate,
  today,
  todayIso,
  workingDaysBetween,
} from "./format";

// --- stock readiness --------------------------------------------------------
// PRD §06 thresholds: Hero SKUs must be 100% in stock → else Blocked.
// Regular SKUs must be ≥ 90% → else Needs Attention. No manual override.

export interface StockSummary {
  readiness: StockReadiness;
  heroPct: number | null;
  regularPct: number | null;
  heroBelowCount: number;
  regularBelowCount: number;
  hubConfirmed: boolean;
  depotConfirmed: Record<Depot, boolean>;
  byDepot: Record<string, { heroPct: number | null; regularPct: number | null; ready: boolean; hasRows: boolean }>;
  totalSkus: number;
  oosSkus: number;
  updatedAt: string | null;
}

function pct(inStock: number, required: number): number {
  if (required <= 0) return 100;
  return Math.min(100, (inStock / required) * 100);
}

export function summarizeStock(rows: StockRow[]): StockSummary {
  const byDepot: StockSummary["byDepot"] = {};
  let heroBelow = 0;
  let regularBelow = 0;
  let totalSkus = 0;
  let oosSkus = 0;
  let updatedAt: string | null = null;

  for (const row of rows) {
    if (!updatedAt || row.imported_at > updatedAt) updatedAt = row.imported_at;
    totalSkus++;
    if (row.units_in_stock <= 0) oosSkus++;
    const bucket = (byDepot[row.depot] ??= {
      heroPct: null,
      regularPct: null,
      ready: true,
      hasRows: false,
    });
    bucket.hasRows = true;
    const p = pct(row.units_in_stock, row.units_required);
    if (row.sku_type === "Hero") {
      bucket.heroPct = bucket.heroPct === null ? p : Math.min(bucket.heroPct, p);
      if (p < 100) {
        heroBelow++;
        bucket.ready = false;
      }
    } else {
      bucket.regularPct = bucket.regularPct === null ? p : Math.min(bucket.regularPct, p);
      if (p < 90) {
        regularBelow++;
        bucket.ready = false;
      }
    }
  }

  const anyRows = rows.length > 0;
  let readiness: StockReadiness = "no_data";
  if (anyRows) {
    if (heroBelow > 0) readiness = "blocked";
    else if (regularBelow > 0) readiness = "attention";
    else readiness = "ready";
  }

  const allHero = rows.filter((r) => r.sku_type === "Hero").map((r) => pct(r.units_in_stock, r.units_required));
  const allReg = rows.filter((r) => r.sku_type === "Regular").map((r) => pct(r.units_in_stock, r.units_required));
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : null);

  const hub = byDepot["Hub"];
  const depotConfirmed = {} as Record<Depot, boolean>;
  for (const d of DEPOTS) {
    const b = byDepot[d];
    depotConfirmed[d] = Boolean(b?.hasRows && b.ready);
  }

  return {
    readiness,
    heroPct: min(allHero),
    regularPct: min(allReg),
    heroBelowCount: heroBelow,
    regularBelowCount: regularBelow,
    hubConfirmed: Boolean(hub?.hasRows && hub.ready),
    depotConfirmed,
    byDepot,
    totalSkus,
    oosSkus,
    updatedAt,
  };
}

export const READINESS_LABELS: Record<StockReadiness, string> = {
  ready: "✅ Ready",
  attention: "⚠️ Needs Attention",
  blocked: "🔴 Blocked",
  no_data: "No stock data",
};

// --- SLA --------------------------------------------------------------------

export type SlaState = "none" | "on_time" | "needs_attention" | "locked_out";

export interface SlaInfo {
  state: SlaState;
  deadline: string | null; // T-3 working-day deadline
  daysOverdue: number; // working days past deadline (0 = not overdue)
  label: string;
}

/**
 * T-3 SLA for Hub Pending / Depots Pending stages.
 * Deadline = 3 working days before launch date. Past deadline → Needs Attention;
 * 5+ working days overdue → Locked Out. Computed on load — no manual trigger.
 */
export function computeSla(campaign: Pick<CampaignRow, "stage" | "launch_date">): SlaInfo {
  const tracked: Stage[] = ["hub_pending", "depots_pending"];
  if (!tracked.includes(campaign.stage)) {
    return { state: "none", deadline: null, daysOverdue: 0, label: "—" };
  }
  const launch = parseDate(campaign.launch_date);
  const deadline = addWorkingDays(launch, -3);
  const t = today();
  if (t.getTime() <= deadline.getTime()) {
    return {
      state: "on_time",
      deadline: deadline.toISOString().slice(0, 10),
      daysOverdue: 0,
      label: "On time",
    };
  }
  const overdue = workingDaysBetween(deadline, t);
  if (overdue >= 5) {
    return {
      state: "locked_out",
      deadline: deadline.toISOString().slice(0, 10),
      daysOverdue: overdue,
      label: `Locked Out — ${overdue} working days overdue`,
    };
  }
  return {
    state: "needs_attention",
    deadline: deadline.toISOString().slice(0, 10),
    daysOverdue: overdue,
    label: `Needs Attention — overdue by ${overdue} working day${overdue === 1 ? "" : "s"}`,
  };
}

// --- lifecycle classification ----------------------------------------------

export type CampaignView = "board" | "ended_unarchived" | "archived" | "rejected";

export function campaignView(campaign: CampaignRow): CampaignView {
  if (campaign.status === "rejected") return "rejected";
  if (campaign.status === "archived") return "archived";
  if (campaign.stage === "live" && campaign.end_date < todayIso() && campaign.status !== "paused") {
    return "ended_unarchived";
  }
  // Paused live campaigns past end date are also ended.
  if (campaign.stage === "live" && campaign.end_date < todayIso()) return "ended_unarchived";
  return "board";
}

export function isEnded(campaign: CampaignRow): boolean {
  return campaignView(campaign) === "ended_unarchived" || campaignView(campaign) === "archived";
}

/** Effective status badge text for cards/tables. */
export function statusBadge(campaign: CampaignRow): { text: string; tone: "green" | "amber" | "red" | "gray" | "blue" } {
  if (campaign.status === "rejected") return { text: "Rejected", tone: "red" };
  if (campaign.status === "archived") return { text: "Archived", tone: "gray" };
  if (campaign.status === "paused") return { text: "Paused", tone: "amber" };
  if (isEnded(campaign)) return { text: "Ended", tone: "gray" };
  return { text: STAGE_LABELS[campaign.stage], tone: "blue" };
}

/** Publish button availability — PRD §07: three conditions simultaneously. */
export interface PublishCheck {
  allowed: boolean;
  reasons: string[]; // blocking conditions (empty when allowed)
}

export function publishCheck(
  campaign: CampaignRow,
  stock: StockSummary,
): PublishCheck {
  const reasons: string[] = [];
  const todayStr = todayIso();
  if (campaign.launch_date !== todayStr) {
    if (campaign.launch_date > todayStr) {
      reasons.push(`Launch date is ${campaign.launch_date} — Publish unlocks on the launch date.`);
    } else {
      reasons.push(`Launch date ${campaign.launch_date} has passed — use Hold to set a new date.`);
    }
  }
  if (stock.readiness === "blocked") {
    const parts: string[] = [];
    if (stock.heroBelowCount > 0) parts.push(`${stock.heroBelowCount} Hero SKU(s) below 100%`);
    if (stock.regularBelowCount > 0) parts.push(`${stock.regularBelowCount} Regular SKU(s) below 90%`);
    reasons.push(`Stock: ${parts.join(", ") || "blocked"}.`);
  }
  if (stock.readiness === "no_data") {
    reasons.push("Stock: no stock values imported yet.");
  }
  if (campaign.content_status !== "approved") {
    reasons.push("Content: banner and notifications not approved yet.");
  }
  return { allowed: reasons.length === 0, reasons };
}

export function monthOfCampaign(campaign: CampaignRow): string {
  return monthOf(campaign.launch_date);
}

export { parseDate };
