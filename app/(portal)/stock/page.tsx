// Stock readiness overview — PRD §06.

import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { summarizeStock, READINESS_LABELS } from "@/lib/campaigns";
import type { StockRow } from "@/lib/types";
import { Badge, DepotDots, EmptyState, PageHeader, StockBadge } from "@/components/ui";
import { fmtDateTime, fmtPct, matchesSearch } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ readiness?: string; q?: string }>;
}) {
  const user = await requireCapability("board_view", "Stock readiness");
  const { readiness = "", q = "" } = await searchParams;

  const db = await getDb();
  const campaigns = await db.selectFrom("campaigns").selectAll().orderBy("launch_date").execute();
  const allStock = await db.selectFrom("stock_rows").selectAll().execute();
  const byCampaign = new Map<number, StockRow[]>();
  for (const row of allStock) {
    const list = byCampaign.get(row.campaign_pk) ?? [];
    list.push(row);
    byCampaign.set(row.campaign_pk, list);
  }

  const rows = campaigns
    .filter((c) => c.status !== "rejected" && c.status !== "archived")
    .map((c) => ({ campaign: c, stock: summarizeStock(byCampaign.get(c.id) ?? []) }))
    .filter(({ campaign, stock }) => {
      if (readiness && stock.readiness !== readiness) return false;
      if (q && !matchesSearch(`${campaign.title} ${campaign.campaign_id} ${allStock.filter((s) => s.campaign_pk === campaign.id).map((s) => s.sku_code).join(" ")}`, q))
        return false;
      return true;
    });

  return (
    <div>
      <PageHeader
        title="Stock readiness"
        subtitle="Hero SKUs must be 100% in stock (below → Blocked). Regular SKUs must be ≥ 90% (below → Needs Attention). Readiness is recalculated on every stock import — no manual override."
        actions={
          can(user.role, "imports") ? (
            <Link href="/imports" className="btn-secondary">
              Import stock sheet
            </Link>
          ) : null
        }
      />

      <form className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Readiness</label>
          <select name="readiness" className="input w-52" defaultValue={readiness}>
            <option value="">All levels</option>
            <option value="ready">{READINESS_LABELS.ready}</option>
            <option value="attention">{READINESS_LABELS.attention}</option>
            <option value="blocked">{READINESS_LABELS.blocked}</option>
            <option value="no_data">{READINESS_LABELS.no_data}</option>
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <input name="q" className="input w-64" placeholder="Campaign or SKU…" defaultValue={q} />
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState>No campaigns match the current filters.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map(({ campaign, stock }) => {
            const depotStatus: Record<string, { confirmed: boolean; hasRows: boolean }> = {};
            for (const d of ["DS_Zayed", "DS_Maadi", "DS_Kitkat", "Hub"]) {
              const b = stock.byDepot[d];
              depotStatus[d] = { confirmed: Boolean(b?.hasRows && b.ready), hasRows: Boolean(b?.hasRows) };
            }
            return (
              <div key={campaign.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link href={`/board/${campaign.id}`} className="text-sm font-bold text-brand-700 hover:underline">
                      {campaign.campaign_id}
                    </Link>
                    <div className="text-base font-semibold text-slate-900">{campaign.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {stock.updatedAt
                        ? `Stock last updated: ${fmtDateTime(stock.updatedAt)}`
                        : "No stock import for this campaign"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StockBadge readiness={stock.readiness} />
                    <DepotDots depotStatus={depotStatus} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">Hero min in-stock %</div>
                    <div className={`text-lg font-bold ${stock.heroPct !== null && stock.heroPct < 100 ? "text-rose-600" : "text-slate-900"}`}>
                      {fmtPct(stock.heroPct)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">Regular min in-stock %</div>
                    <div className={`text-lg font-bold ${stock.regularPct !== null && stock.regularPct < 90 ? "text-amber-600" : "text-slate-900"}`}>
                      {fmtPct(stock.regularPct)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">Below-threshold SKUs</div>
                    <div className="text-lg font-bold text-slate-900">
                      {stock.heroBelowCount + stock.regularBelowCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">OOS / tracked</div>
                    <div className="text-lg font-bold text-slate-900">
                      {stock.oosSkus} / {stock.totalSkus}
                    </div>
                  </div>
                </div>

                {stock.heroBelowCount > 0 ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                    🔴 Blocked — {stock.heroBelowCount} Hero SKU(s) below 100%. Publish is disabled until a
                    corrected stock sheet is imported.
                  </div>
                ) : null}
                {stock.heroBelowCount === 0 && stock.regularBelowCount > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                    ⚠️ Needs Attention — {stock.regularBelowCount} Regular SKU(s) below 90%. Publish is allowed
                    with a warning.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
