// Campaign history / Archive — PRD §12. Ended campaigns arrive here when
// Content marks them as taken down. Rejected campaigns are kept too.

import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { loadAllCampaignCards } from "@/lib/queries";
import { getDb } from "@/lib/db";
import { Badge, EmptyState, PageHeader, StockBadge } from "@/components/ui";
import { fmtDate, fmtEgp } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ended", label: "Ended, not yet archived" },
  { key: "archived", label: "Archived (Campaign History)" },
  { key: "rejected", label: "Rejected" },
] as const;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireCapability("board_view", "Campaign history");
  const { tab = "ended" } = await searchParams;

  const cards = await loadAllCampaignCards();
  const db = await getDb();
  const planning = await db.selectFrom("planning_entries").selectAll().execute();
  const planningByTitle = new Map(planning.map((p) => [p.title.toLowerCase(), p]));

  const filtered = cards.filter((c) => {
    if (tab === "ended") return c.view === "ended_unarchived";
    if (tab === "archived") return c.view === "archived";
    return c.view === "rejected";
  });

  return (
    <div>
      <PageHeader
        title="Campaign history"
        subtitle="When a campaign's end date passes it becomes Ended; once Content marks it as taken down it moves to the permanent archive. Rejected campaigns are preserved here too."
      />

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/archive?tab=${t.key}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === t.key ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState>
          {tab === "ended"
            ? "Nothing here — campaigns arrive once their end date passes."
            : tab === "archived"
              ? "Nothing here — campaigns arrive once Content takes them down."
              : "No rejected campaigns."}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const plan = planningByTitle.get(c.title.toLowerCase());
            return (
              <div key={c.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <Link href={`/board/${c.id}`} className="text-sm font-bold text-brand-700 hover:underline">
                    {c.campaignId}
                  </Link>
                  <div className="text-base font-semibold text-slate-900">{c.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {fmtDate(c.launchDate)} → {fmtDate(c.endDate)} · owner {c.briefOwner}
                    {plan ? ` · target ${fmtEgp(plan.revenue_target)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StockBadge readiness={c.stockReadiness} />
                  {c.view === "ended_unarchived" ? <Badge tone="amber">Ended — awaiting takedown</Badge> : null}
                  {c.view === "archived" ? <Badge tone="gray">Archived</Badge> : null}
                  {c.view === "rejected" ? <Badge tone="red">Rejected</Badge> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
