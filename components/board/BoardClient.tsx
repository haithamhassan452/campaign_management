"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampaignCard } from "@/lib/queries";
import { STAGE_LABELS, STAGE_ORDER, type Stage } from "@/lib/types";
import { Badge, DepotDots, StockBadge, ContentBadge, EmptyState } from "@/components/ui";
import { fmtDate, matchesSearch } from "@/lib/format";

const STAGE_STYLES: Record<Stage, string> = {
  in_pipeline: "border-t-slate-400",
  hub_pending: "border-t-violet-400",
  depots_pending: "border-t-indigo-400",
  content_pending: "border-t-amber-400",
  live: "border-t-emerald-500",
};

export default function BoardClient({ cards }: { cards: CampaignCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return cards;
    return cards.filter(
      (c) =>
        matchesSearch(`${c.title} ${c.campaignId} ${c.skuText}`, query),
    );
  }, [cards, query]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="relative w-full max-w-md">
          <input
            className="input pl-9"
            placeholder="Search by title, CMP ID, or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
        </div>
        <div className="text-xs text-slate-400">
          {filtered.length} campaign{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {STAGE_ORDER.map((stage) => {
          const stageCards = filtered.filter((c) => c.stage === stage);
          return (
            <div key={stage} className={`rounded-xl border border-slate-200 border-t-4 bg-slate-100/60 p-3 ${STAGE_STYLES[stage]}`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-slate-700">{STAGE_LABELS[stage]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {stageCards.length}
                </span>
              </div>

              <div className="space-y-3">
                {stageCards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/board/${card.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-3 shadow-card transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-brand-700">{card.campaignId}</span>
                      {card.bannerType ? <Badge tone="purple">{card.bannerType}</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-snug text-slate-900">
                      {card.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {fmtDate(card.launchDate)} → {fmtDate(card.endDate)}
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${card.hubConfirmed ? "bg-emerald-500" : card.hubHasRows ? "bg-rose-500" : "bg-slate-300"}`}
                        />
                        <span className="text-slate-500">
                          {card.hubConfirmed
                            ? "Critical SKUs confirmed"
                            : card.hubHasRows
                              ? "Hub below threshold"
                              : "Critical SKUs pending"}
                        </span>
                      </div>
                      <DepotDots depotStatus={card.depotStatus} />
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <StockBadge readiness={card.stockReadiness} />
                        <ContentBadge status={card.contentStatus} />
                      </div>
                    </div>

                    {card.sla.state === "needs_attention" || card.sla.state === "locked_out" ? (
                      <div className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                        ⚠ {card.sla.label}
                      </div>
                    ) : null}
                    {card.sentBack ? (
                      <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                        ↩ Sent back — see detail panel
                      </div>
                    ) : null}
                    {card.paused ? (
                      <div className="mt-2">
                        <Badge tone="amber">⏸ Paused</Badge>
                      </div>
                    ) : null}
                  </Link>
                ))}

                {stageCards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    {stage === "in_pipeline"
                      ? "Nothing here — a new brief goes straight to Procurement."
                      : "Empty"}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState>No campaigns match your search.</EmptyState>
        </div>
      ) : null}
    </div>
  );
}
