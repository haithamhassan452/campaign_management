// Performance analysis — PRD §10. Primary KPI: sales revenue vs target.

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { STAGE_LABELS } from "@/lib/types";
import { Badge, DataSourceLabel, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { addWorkingDays, fmtDate, fmtEgp, fmtPct, monthLabel, monthOf, parseDate, todayIso, workingDaysBetween } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; status?: string; theme?: string }>;
}) {
  await requireCapability("performance_view", "Performance");
  const params = await searchParams;
  const month = params.month || todayIso().slice(0, 7);
  const status = params.status || "";
  const themeFilter = params.theme || "";

  const db = await getDb();
  const campaigns = await db.selectFrom("campaigns").selectAll().execute();
  const planning = await db.selectFrom("planning_entries").selectAll().execute();
  const results = await db.selectFrom("performance_results").selectAll().execute();
  const logs = await db.selectFrom("activity_logs").selectAll().orderBy("date", "desc").execute();
  const logLinks = await db.selectFrom("activity_log_campaigns").selectAll().execute();

  const planningByTitle = new Map(planning.map((p) => [p.title.toLowerCase(), p]));
  const resultByKey = new Map(results.map((r) => [`${r.campaign_pk}:${r.reporting_period}`, r]));

  // Cohort: campaigns launching in the selected month.
  const cohort = campaigns.filter((c) => monthOf(c.launch_date) === month);
  const orphanPlans = planning.filter(
    (p) =>
      monthOf(p.planned_launch_date) === month &&
      !campaigns.some((c) => c.title.toLowerCase() === p.title.toLowerCase()),
  );

  const rows = cohort.map((c) => {
    const plan = planningByTitle.get(c.title.toLowerCase()) ?? null;
    const target = plan?.revenue_target ?? null;
    const result = resultByKey.get(`${c.id}:${month}`) ?? null;
    const published = Boolean(c.published_at);
    const rejected = c.status === "rejected";
    const held = c.status === "paused" && !published;
    const actual = result?.actual_revenue ?? null;
    const variance = target !== null && actual !== null ? actual - target : null;
    const success = variance !== null ? variance >= 0 : null;
    return { c, plan, target, result, published, rejected, held, actual, variance, success };
  });

  const filteredRows = rows.filter((r) => {
    if (status === "success" && r.success !== true) return false;
    if (status === "failure" && r.success !== false) return false;
    if (status === "published" && !r.published) return false;
    if (status === "unpublished" && r.published) return false;
    if (themeFilter && r.plan?.theme !== themeFilter) return false;
    return true;
  });

  const publishedRows = rows.filter((r) => r.published);
  const unpublishedRows = rows.filter((r) => !r.published);
  const successCount = publishedRows.filter((r) => r.success === true).length;
  const successRate = publishedRows.length ? (successCount / publishedRows.length) * 100 : null;

  const totalTarget = rows.reduce((s, r) => s + (r.target ?? 0), 0);
  const totalActual = rows.reduce((s, r) => s + (r.actual ?? 0), 0);

  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v !== null && v !== undefined);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const avgCtr = avg(rows.map((r) => r.result?.ctr ?? null));
  const avgConv = avg(rows.map((r) => r.result?.conversion_rate ?? null));
  const oosRate = avg(
    rows.map((r) => (r.result ? (r.result.oos_incidents / Math.max(1, r.c.critical_skus ? JSON.parse(r.c.critical_skus).length : 1)) * 100 : null)),
  );

  // SLA compliance: campaigns that cleared hub+depots gates within their T-3 window.
  const slaTracked = rows.filter((r) => r.c.depots_confirmed_at || r.c.hub_confirmed_at);
  const slaOnTime = slaTracked.filter((r) => {
    const deadline = addWorkingDays(parseDate(r.c.launch_date), -3);
    const done = r.c.depots_confirmed_at ? new Date(r.c.depots_confirmed_at) : new Date(r.c.hub_confirmed_at!);
    return done.getTime() <= addWorkingDays(deadline, 3).getTime();
  });
  const slaCompliance = slaTracked.length ? (slaOnTime.length / slaTracked.length) * 100 : null;

  const latestImport = results
    .filter((r) => r.reporting_period === month)
    .map((r) => r.imported_at)
    .sort()
    .pop() ?? null;

  const monthLogs = logs.filter((l) => monthOf(l.date) === month);
  const themes = [...new Set(planning.map((p) => p.theme))].sort();

  const failureRows = rows.filter((r) => r.published && r.success === false);
  const unpublishedDetail = rows.filter((r) => !r.published);

  return (
    <div>
      <PageHeader
        title="Performance analysis"
        subtitle="Sales revenue vs campaign target is the primary KPI. Supporting metrics come from the portal pipeline and manual sheet imports (GA4 live data is Phase 2)."
        actions={
          <form className="flex items-end gap-3">
            <div>
              <label className="label">Month</label>
              <input type="month" name="month" className="input w-44" defaultValue={month} />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input w-40" defaultValue={status}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
            <div>
              <label className="label">Theme</label>
              <select name="theme" className="input w-44" defaultValue={themeFilter}>
                <option value="">All themes</option>
                {themes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </form>
        }
      />

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{monthLabel(month)}</h2>
        <DataSourceLabel importedAt={latestImport ? latestImport.slice(0, 10) : null} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard label="Planned" value={rows.length + orphanPlans.length} sub={`${orphanPlans.length} without briefs`} />
        <StatCard label="Published" value={publishedRows.length} tone="green" sub="Went live" />
        <StatCard label="Unpublished" value={unpublishedRows.length} tone="red" sub={`Unpublished rate ${rows.length ? fmtPct((unpublishedRows.length / rows.length) * 100) : "—"}`} />
        <StatCard
          label="Success rate"
          value={successRate !== null ? fmtPct(successRate) : "—"}
          sub={`${successCount} of ${publishedRows.length} published met target`}
        />
        <StatCard
          label="Revenue vs target"
          value={totalTarget ? fmtPct((totalActual / totalTarget) * 100) : "—"}
          tone={totalTarget && totalActual >= totalTarget ? "green" : "red"}
          sub={`${fmtEgp(totalActual)} of ${fmtEgp(totalTarget)}`}
        />
        <StatCard label="SLA compliance" value={slaCompliance !== null ? fmtPct(slaCompliance) : "—"} sub="Stages completed within SLA" />
      </div>

      {/* Supporting metrics */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg CTR</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{fmtPct(avgCtr)}</div>
          <div className="text-xs text-slate-400">Banner click-through — sheet import → GA4 Phase 2</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg conversion rate</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{fmtPct(avgConv)}</div>
          <div className="text-xs text-slate-400">Orders from campaign traffic % of sessions</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">OOS rate on featured SKUs</div>
          <div className="mt-1 text-xl font-bold text-slate-900">{fmtPct(oosRate)}</div>
          <div className="text-xs text-slate-400">Featured SKUs that went OOS during campaigns</div>
        </div>
      </div>

      {/* Campaign-level table */}
      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Campaign results</h2>
      {filteredRows.length === 0 ? (
        <EmptyState>No results imported for this month yet — import a performance sheet to see results.</EmptyState>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Campaign</th>
                <th className="th">Theme</th>
                <th className="th">Status</th>
                <th className="th">Revenue target</th>
                <th className="th">Actual revenue</th>
                <th className="th">Variance</th>
                <th className="th">CTR</th>
                <th className="th">Conv.</th>
                <th className="th">OOS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => {
                const met = r.success === true;
                return (
                  <tr key={r.c.id} className={r.success === false ? "bg-rose-50/50" : r.success === true ? "bg-emerald-50/40" : ""}>
                    <td className="td">
                      <div className="font-semibold text-slate-900">{r.c.title}</div>
                      <div className="text-xs text-slate-400">{r.c.campaign_id} · {fmtDate(r.c.launch_date)}</div>
                    </td>
                    <td className="td">{r.plan ? <Badge tone="purple">{r.plan.theme}</Badge> : "—"}</td>
                    <td className="td">
                      {r.published ? (
                        <Badge tone="green">Published</Badge>
                      ) : r.rejected ? (
                        <Badge tone="red">Rejected</Badge>
                      ) : r.held ? (
                        <Badge tone="amber">Held</Badge>
                      ) : (
                        <Badge tone="gray">{STAGE_LABELS[r.c.stage]}</Badge>
                      )}
                    </td>
                    <td className="td">{fmtEgp(r.target)}</td>
                    <td className="td font-semibold">{fmtEgp(r.actual)}</td>
                    <td className={`td font-semibold ${r.variance === null ? "" : met ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.variance === null ? "—" : `${r.variance >= 0 ? "+" : ""}${fmtEgp(r.variance)}`}
                    </td>
                    <td className="td">{fmtPct(r.result?.ctr ?? null)}</td>
                    <td className="td">{fmtPct(r.result?.conversion_rate ?? null)}</td>
                    <td className="td">{r.result?.oos_incidents ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-6">
        {/* Failure analysis */}
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Failure analysis — missed targets</h3>
          {failureRows.length === 0 && unpublishedDetail.length === 0 ? (
            <p className="text-sm text-slate-400">No failures recorded for this month.</p>
          ) : (
            <div className="space-y-3">
              {failureRows.map((r) => (
                <div key={r.c.id} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {r.c.title} <span className="text-xs font-normal text-slate-400">({r.c.campaign_id})</span>
                  </div>
                  <div className="mt-1 text-xs text-rose-700">
                    Missed target by {fmtEgp(Math.abs(r.variance ?? 0))} — exited at {STAGE_LABELS[r.c.stage]}
                  </div>
                </div>
              ))}
              {unpublishedDetail.map((r) => (
                <div key={r.c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {r.c.title} <span className="text-xs font-normal text-slate-400">({r.c.campaign_id})</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Did not publish — exited at {STAGE_LABELS[r.c.stage]}
                    {r.c.reject_reason ? ` · ${r.c.reject_reason}` : ""}
                    {r.c.pause_reason ? ` · ${r.c.pause_reason}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity correlation */}
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Activity log correlation — {monthLogs.length} optimization action{monthLogs.length === 1 ? "" : "s"} this month
          </h3>
          {monthLogs.length === 0 ? (
            <p className="text-sm text-slate-400">No optimization actions logged this month.</p>
          ) : (
            <div className="space-y-2">
              {monthLogs.slice(0, 8).map((l) => {
                const linked = logLinks
                  .filter((x) => x.log_id === l.id)
                  .map((x) => campaigns.find((c) => c.id === x.campaign_pk))
                  .filter(Boolean);
                return (
                  <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
                    <div>
                      <div className="text-sm text-slate-800">{l.description}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {fmtDate(l.date)} · {l.action_type} · {linked.map((c) => c!.campaign_id).join(", ")}
                      </div>
                    </div>
                    {l.impact ? <Badge tone="green">{l.impact}</Badge> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
