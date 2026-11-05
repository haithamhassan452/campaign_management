// Activity log — PRD §09. Separate section; entries link to one or more
// campaigns. Viewable by all roles; only Performance Member and Admin create.

import { requireCapability } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { ACTIVITY_ACTION_TYPES } from "@/lib/types";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { fmtDate, monthLabel, monthOf, matchesSearch } from "@/lib/format";
import ActivityForm from "@/components/activity/ActivityForm";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; action?: string; from?: string; to?: string; q?: string }>;
}) {
  const user = await requireCapability("activity_view", "Activity log");
  const { campaign = "", action = "", from = "", to = "", q = "" } = await searchParams;

  const db = await getDb();
  const logs = await db
    .selectFrom("activity_logs")
    .selectAll()
    .orderBy("date", "desc")
    .orderBy("id", "desc")
    .execute();
  const links = await db.selectFrom("activity_log_campaigns").selectAll().execute();
  const campaigns = await db
    .selectFrom("campaigns")
    .select(["id", "campaign_id", "title"])
    .execute();
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  const linkedFor = (logId: number) =>
    links
      .filter((l) => l.log_id === logId)
      .map((l) => campaignById.get(l.campaign_pk))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const rows = logs
    .map((log) => ({ log, linked: linkedFor(log.id) }))
    .filter(({ log, linked }) => {
      if (campaign) {
        const pk = Number(campaign);
        if (!links.some((l) => l.log_id === log.id && l.campaign_pk === pk)) return false;
      }
      if (action && log.action_type !== action) return false;
      if (from && log.date < from) return false;
      if (to && log.date > to) return false;
      if (q && !matchesSearch(`${log.description} ${log.impact ?? ""} ${log.owner} ${linked.map((c) => c.title + c.campaign_id).join(" ")}`, q))
        return false;
      return true;
    });

  // Monthly rollup (over unfiltered logs — PRD monthly summary)
  const byMonth = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = monthOf(log.date);
    const list = byMonth.get(key) ?? [];
    list.push(log);
    byMonth.set(key, list);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle="Every optimization action taken during or after a campaign, linked to one or more campaigns. Sorted newest first."
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total entries" value={logs.length} sub="All time" />
        {months.slice(0, 3).map((m) => (
          <StatCard
            key={m}
            label={monthLabel(m)}
            value={byMonth.get(m)!.length}
            sub="entries logged"
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6">
        {/* create + filters */}
        <div className="space-y-6">
          {can(user.role, "activity_manage") ? (
            <ActivityForm
              campaigns={campaigns.map((c) => ({ id: c.id, label: `${c.campaign_id} — ${c.title}` }))}
              actionTypes={[...ACTIVITY_ACTION_TYPES]}
            />
          ) : (
            <div className="card p-5 text-sm text-slate-500">
              Only Performance Members and Admins can log optimization actions. You have view-only
              access.
            </div>
          )}

          <form className="card space-y-4 p-5">
            <h3 className="text-sm font-bold text-slate-900">Filters</h3>
            <div>
              <label className="label">Campaign</label>
              <select name="campaign" className="input" defaultValue={campaign}>
                <option value="">All campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaign_id} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Action type</label>
              <select name="action" className="input" defaultValue={action}>
                <option value="">All types</option>
                {ACTIVITY_ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">From</label>
                <input type="date" name="from" className="input" defaultValue={from} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" name="to" className="input" defaultValue={to} />
              </div>
            </div>
            <div>
              <label className="label">Search</label>
              <input name="q" className="input" placeholder="Description, impact, owner…" defaultValue={q} />
            </div>
            <button type="submit" className="btn-primary w-full">
              Apply filters
            </button>
          </form>

          {/* monthly rollup */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Monthly rollup</h3>
            <div className="space-y-4">
              {months.map((m) => {
                const list = byMonth.get(m)!;
                const counts = new Map<string, number>();
                for (const log of list) {
                  counts.set(log.action_type, (counts.get(log.action_type) ?? 0) + 1);
                }
                return (
                  <div key={m} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{monthLabel(m)}</span>
                      <Badge tone="blue">{list.length} entries</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...counts.entries()].map(([t, n]) => (
                        <Badge key={t} tone="gray">
                          {t}: {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {months.length === 0 ? <p className="text-sm text-slate-400">No entries yet.</p> : null}
            </div>
          </div>
        </div>

        {/* entries list */}
        <div className="col-span-2">
          {rows.length === 0 ? (
            <EmptyState>No entries yet — log the first optimization action for this month.</EmptyState>
          ) : (
            <div className="space-y-3">
              {rows.map(({ log, linked }) => (
                <div key={log.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="purple">{log.action_type}</Badge>
                      <span className="text-xs text-slate-400">{fmtDate(log.date)}</span>
                    </div>
                    <span className="text-xs text-slate-400">Owner: {log.owner}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{log.description}</p>
                  {log.impact ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700">Impact: {log.impact}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {linked.map((c) => (
                      <Badge key={c.id} tone="blue">
                        {c.campaign_id} · {c.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
