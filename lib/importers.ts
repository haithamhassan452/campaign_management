// Sheet import pipeline — PRD §11.
// Three import types, Admin-only. Every import validates ALL rows before
// committing; partial imports are never applied. Errors are returned as a
// list and logged to import history.

import { getDb, nowIso } from "./db";
import type { AppDatabase } from "./db";
import type { ImportType, Depot, PlanningPeriod } from "./types";
import { parseCsvTable, parseDateCell, parseMonthCell, parseNumberCell } from "./csv";
import { publishCheck, summarizeStock } from "./campaigns";

export interface ImportResult {
  ok: boolean;
  rowCount: number;
  errors: string[];
  message: string;
}

function err(row: number, msg: string): string {
  return `Row ${row}: ${msg}`;
}

// --- Campaign calendar ------------------------------------------------------
// Columns: Campaign title, Theme / category, Planning period, Planned launch date,
// Planned end date, Revenue target (EGP), Campaign owner, Notes

export async function importCampaignCalendar(
  db: AppDatabase,
  csvText: string,
  adminUsername: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvTable(csvText);
  const find = (obj: Record<string, string>, ...names: string[]) => {
    for (const n of names) {
      const key = headers.find((h) => h.toLowerCase() === n.toLowerCase());
      if (key && obj[key] !== undefined) return obj[key];
    }
    return "";
  };

  const errors: string[] = [];
  const parsed: {
    title: string;
    theme: string;
    period: PlanningPeriod;
    launch: string;
    end: string;
    target: number;
    owner: string;
    notes: string | null;
  }[] = [];

  if (rows.length === 0) errors.push("Sheet contains no data rows.");

  rows.forEach((row, i) => {
    const rowNo = i + 2; // header = row 1
    const title = find(row, "Campaign title", "title").trim();
    const theme = find(row, "Theme / category", "Theme", "category").trim();
    const periodRaw = find(row, "Planning period", "period").trim();
    const launch = parseDateCell(find(row, "Planned launch date", "launch date"));
    const end = parseDateCell(find(row, "Planned end date", "end date"));
    const target = parseNumberCell(find(row, "Revenue target (EGP)", "Revenue target", "target"));
    const owner = find(row, "Campaign owner", "owner").trim();
    const notes = find(row, "Notes", "notes").trim() || null;

    if (!title) errors.push(err(rowNo, "Campaign title is required."));
    if (!theme) errors.push(err(rowNo, "Theme / category is required."));
    const period = ["Yearly", "Quarterly", "Monthly"].find(
      (p) => p.toLowerCase() === periodRaw.toLowerCase(),
    ) as PlanningPeriod | undefined;
    if (!period) errors.push(err(rowNo, `Planning period must be Yearly, Quarterly or Monthly (got "${periodRaw}").`));
    if (!launch) errors.push(err(rowNo, "Planned launch date is invalid or missing."));
    if (!end) errors.push(err(rowNo, "Planned end date is invalid or missing."));
    if (launch && end && end <= launch) errors.push(err(rowNo, "Planned end date must be after launch date."));
    if (target === null) errors.push(err(rowNo, "Revenue target (EGP) must be a number."));
    if (!owner) errors.push(err(rowNo, "Campaign owner is required."));

    if (title && theme && period && launch && end && end > launch && target !== null && owner) {
      parsed.push({ title, theme, period, launch, end, target, owner, notes });
    }
  });

  return commit(db, "campaign_calendar", adminUsername, parsed.length, errors, async () => {
    const now = nowIso();
    for (const p of parsed) {
      const existing = await db
        .selectFrom("planning_entries")
        .select(["id"])
        .where("title", "=", p.title)
        .where("planned_launch_date", "=", p.launch)
        .executeTakeFirst();
      if (existing) {
        await db
          .updateTable("planning_entries")
          .set({
            theme: p.theme,
            period: p.period,
            planned_end_date: p.end,
            revenue_target: p.target,
            owner: p.owner,
            notes: p.notes,
            imported_at: now,
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("planning_entries")
          .values({
            title: p.title,
            theme: p.theme,
            period: p.period,
            planned_launch_date: p.launch,
            planned_end_date: p.end,
            revenue_target: p.target,
            owner: p.owner,
            notes: p.notes,
            imported_at: now,
          })
          .execute();
      }
    }
    return `${parsed.length} planning entr${parsed.length === 1 ? "y" : "ies"} imported.`;
  });
}

// --- Stock values -----------------------------------------------------------
// Columns: Campaign ID, SKU code, SKU type, Units in stock, Units required, Depot

export async function importStockValues(
  db: AppDatabase,
  csvText: string,
  adminUsername: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvTable(csvText);
  const find = (obj: Record<string, string>, ...names: string[]) => {
    for (const n of names) {
      const key = headers.find((h) => h.toLowerCase() === n.toLowerCase());
      if (key && obj[key] !== undefined) return obj[key];
    }
    return "";
  };

  const errors: string[] = [];
  const parsed: {
    campaignPk: number;
    campaignId: string;
    sku: string;
    skuType: "Hero" | "Regular";
    inStock: number;
    required: number;
    depot: Depot;
  }[] = [];

  if (rows.length === 0) errors.push("Sheet contains no data rows.");

  const campaignCache = new Map<string, number>();
  const allCampaigns = await db.selectFrom("campaigns").select(["id", "campaign_id"]).execute();
  for (const c of allCampaigns) campaignCache.set(c.campaign_id.toUpperCase(), c.id);

  rows.forEach((row, i) => {
    const rowNo = i + 2;
    const campaignId = find(row, "Campaign ID", "campaign_id").trim().toUpperCase();
    const sku = find(row, "SKU code", "SKU", "sku code").trim();
    const skuTypeRaw = find(row, "SKU type", "sku type").trim();
    const inStock = parseNumberCell(find(row, "Units in stock", "in stock"));
    const required = parseNumberCell(find(row, "Units required", "required"));
    const depotRaw = find(row, "Depot", "depot", "Location").trim();

    const pk = campaignCache.get(campaignId);
    if (!campaignId || pk === undefined) {
      errors.push(err(rowNo, `Campaign ID "${campaignId || "?"}" does not exist in the portal.`));
    }
    const skuType = ["Hero", "Regular"].find(
      (t) => t.toLowerCase() === skuTypeRaw.toLowerCase(),
    ) as "Hero" | "Regular" | undefined;
    if (!skuType) errors.push(err(rowNo, `SKU type must be Hero or Regular (got "${skuTypeRaw}").`));
    if (!sku) errors.push(err(rowNo, "SKU code is required."));
    if (inStock === null || inStock < 0) errors.push(err(rowNo, "Units in stock must be a number ≥ 0."));
    if (required === null || required <= 0) errors.push(err(rowNo, "Units required must be a number > 0."));
    const depot = ["Hub", "DS_Zayed", "DS_Maadi", "DS_Kitkat"].find(
      (d) => d.toLowerCase() === depotRaw.toLowerCase(),
    ) as Depot | undefined;
    if (!depot) {
      errors.push(err(rowNo, `Depot must be Hub, DS_Zayed, DS_Maadi or DS_Kitkat (got "${depotRaw}").`));
    }

    if (pk !== undefined && skuType && sku && inStock !== null && inStock >= 0 && required !== null && required > 0 && depot) {
      parsed.push({ campaignPk: pk, campaignId, sku, skuType, inStock, required, depot });
    }
  });

  return commit(db, "stock_values", adminUsername, parsed.length, errors, async () => {
    const now = nowIso();
    // Group by campaign — previous stock data per campaign is REPLACED (PRD §06).
    const byCampaign = new Map<number, typeof parsed>();
    for (const p of parsed) {
      const list = byCampaign.get(p.campaignPk) ?? [];
      list.push(p);
      byCampaign.set(p.campaignPk, list);
    }
    for (const [campaignPk, list] of byCampaign) {
      await db.deleteFrom("stock_rows").where("campaign_pk", "=", campaignPk).execute();
      for (const p of list) {
        await db
          .insertInto("stock_rows")
          .values({
            campaign_pk: campaignPk,
            sku_code: p.sku,
            sku_type: p.skuType,
            units_in_stock: p.inStock,
            units_required: p.required,
            depot: p.depot,
            imported_at: now,
          })
          .execute();
      }
      // Recompute readiness + auto-advance gates (PRD §05/§06).
      const rowsAll = await db.selectFrom("stock_rows").selectAll().where("campaign_pk", "=", campaignPk).execute();
      const summary = summarizeStock(rowsAll);
      const campaign = await db.selectFrom("campaigns").selectAll().where("id", "=", campaignPk).executeTakeFirstOrThrow();

      const updates: Record<string, unknown> = {
        stock_readiness: summary.readiness,
        stock_updated_at: now,
      };

      // Hub Pending → Depots Pending when Hub rows exist and pass thresholds.
      if (campaign.stage === "hub_pending" && summary.hubConfirmed) {
        updates.stage = "depots_pending";
        updates.hub_confirmed_at = now;
      }
      // Depots Pending → Content Pending when all 3 depots confirmed.
      if (
        campaign.stage === "depots_pending" &&
        summary.depotConfirmed.DS_Zayed &&
        summary.depotConfirmed.DS_Maadi &&
        summary.depotConfirmed.DS_Kitkat
      ) {
        updates.stage = "content_pending";
        updates.depots_confirmed_at = now;
      }
      // If campaign is Live, Publish state is derived — but re-check blockage only.

      await db.updateTable("campaigns").set(updates).where("id", "=", campaignPk).execute();

      if (updates.stage && updates.stage !== campaign.stage) {
        await db
          .insertInto("campaign_events")
          .values({
            campaign_pk: campaignPk,
            action: updates.stage === "depots_pending" ? "stage_depots" : "stage_content",
            actor: adminUsername,
            reason: null,
            details: `Stock import confirmed readiness — moved to ${updates.stage === "depots_pending" ? "Depots Pending" : "Content Pending"}.`,
            created_at: now,
          })
          .execute();
      }
    }
    return `${parsed.length} stock row${parsed.length === 1 ? "" : "s"} imported across ${byCampaign.size} campaign${byCampaign.size === 1 ? "" : "s"}. Readiness recalculated.`;
  });
}

// --- Performance results ----------------------------------------------------
// Columns: Campaign ID, Actual revenue (EGP), CTR (%), Conversion rate (%),
// OOS incidents, Reporting period

export async function importPerformanceResults(
  db: AppDatabase,
  csvText: string,
  adminUsername: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvTable(csvText);
  const find = (obj: Record<string, string>, ...names: string[]) => {
    for (const n of names) {
      const key = headers.find((h) => h.toLowerCase() === n.toLowerCase());
      if (key && obj[key] !== undefined) return obj[key];
    }
    return "";
  };

  const errors: string[] = [];
  const parsed: {
    campaignPk: number;
    revenue: number;
    ctr: number | null;
    conv: number | null;
    oos: number;
    period: string;
  }[] = [];

  if (rows.length === 0) errors.push("Sheet contains no data rows.");

  const allCampaigns = await db.selectFrom("campaigns").select(["id", "campaign_id"]).execute();
  const campaignCache = new Map<string, number>();
  for (const c of allCampaigns) campaignCache.set(c.campaign_id.toUpperCase(), c.id);

  rows.forEach((row, i) => {
    const rowNo = i + 2;
    const campaignId = find(row, "Campaign ID", "campaign_id").trim().toUpperCase();
    const revenue = parseNumberCell(find(row, "Actual revenue (EGP)", "Actual revenue", "revenue"));
    const ctr = parseNumberCell(find(row, "CTR (%)", "CTR"));
    const conv = parseNumberCell(find(row, "Conversion rate (%)", "Conversion rate"));
    const oos = parseNumberCell(find(row, "OOS incidents", "OOS"));
    const period = parseMonthCell(find(row, "Reporting period", "period"));

    const pk = campaignCache.get(campaignId);
    if (!campaignId || pk === undefined) {
      errors.push(err(rowNo, `Campaign ID "${campaignId || "?"}" does not exist in the portal.`));
    }
    if (revenue === null) errors.push(err(rowNo, "Actual revenue (EGP) must be a number."));
    if (oos === null || oos < 0) errors.push(err(rowNo, "OOS incidents must be a number ≥ 0."));
    if (!period) errors.push(err(rowNo, "Reporting period must be a valid month/year (e.g. 2026-11 or 11/2026)."));
    if (ctr !== null && (ctr < 0 || ctr > 100)) errors.push(err(rowNo, "CTR (%) must be between 0 and 100."));
    if (conv !== null && (conv < 0 || conv > 100)) errors.push(err(rowNo, "Conversion rate (%) must be between 0 and 100."));

    if (pk !== undefined && revenue !== null && oos !== null && oos >= 0 && period) {
      parsed.push({ campaignPk: pk, revenue, ctr, conv, oos, period });
    }
  });

  return commit(db, "performance_results", adminUsername, parsed.length, errors, async () => {
    const now = nowIso();
    for (const p of parsed) {
      const existing = await db
        .selectFrom("performance_results")
        .select(["id"])
        .where("campaign_pk", "=", p.campaignPk)
        .where("reporting_period", "=", p.period)
        .executeTakeFirst();
      if (existing) {
        await db
          .updateTable("performance_results")
          .set({
            actual_revenue: p.revenue,
            ctr: p.ctr,
            conversion_rate: p.conv,
            oos_incidents: p.oos,
            imported_at: now,
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("performance_results")
          .values({
            campaign_pk: p.campaignPk,
            actual_revenue: p.revenue,
            ctr: p.ctr,
            conversion_rate: p.conv,
            oos_incidents: p.oos,
            reporting_period: p.period,
            imported_at: now,
          })
          .execute();
      }
    }
    return `${parsed.length} performance result${parsed.length === 1 ? "" : "s"} imported.`;
  });
}

// --- shared commit/error-log wrapper ---------------------------------------

async function commit(
  db: AppDatabase,
  importType: ImportType,
  adminUsername: string,
  rowCount: number,
  errors: string[],
  apply: () => Promise<string>,
): Promise<ImportResult> {
  if (errors.length > 0) {
    await db
      .insertInto("import_history")
      .values({
        import_type: importType,
        created_at: nowIso(),
        admin_username: adminUsername,
        row_count: rowCount,
        status: "error",
        error_report: errors.join("\n"),
      })
      .execute();
    return {
      ok: false,
      rowCount,
      errors,
      message: `Import rejected — ${errors.length} validation error${errors.length === 1 ? "" : "s"}. No rows were committed. Fix the sheet and re-import.`,
    };
  }
  const message = await apply();
  await db
    .insertInto("import_history")
    .values({
      import_type: importType,
      created_at: nowIso(),
      admin_username: adminUsername,
      row_count: rowCount,
      status: "success",
      error_report: null,
    })
    .execute();
  return { ok: true, rowCount, errors: [], message };
}

// Re-exported so importers stay the single place readiness side-effects live.
export { publishCheck };
