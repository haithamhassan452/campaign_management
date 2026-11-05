import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadCampaignDetail } from "@/lib/queries";
import { publishCheck } from "@/lib/campaigns";
import { STAGE_LABELS, ROLE_LABELS, type Role } from "@/lib/types";
import {
  Badge,
  ContentBadge,
  DataSourceLabel,
  NotificationBadge,
  PageHeader,
  StockBadge,
} from "@/components/ui";
import { fmtDate, fmtDateTime, fmtEgp, fmtPct, todayIso } from "@/lib/format";
import ActionForms from "@/components/board/ActionForms";
import type { NotificationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  brief_submitted: "Brief submitted",
  brief_accepted: "Brief accepted — stock check started",
  sent_back: "Sent back",
  stage_depots: "Moved to Depots Pending",
  stage_content: "Moved to Content Pending",
  content_approved: "Content approved",
  content_rejected: "Content rejected",
  published: "Published — Live",
  paused: "Paused",
  resumed: "Resumed",
  hold: "Hold — new date set",
  rejected: "Rejected",
  taken_down: "Taken down",
  archived: "Archived",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await loadCampaignDetail(Number(id));
  if (!detail) notFound();

  const check = publishCheck(detail.campaign, detail.stock);
  const canAll = can(user.role, "actions_all");
  const canApproveReject = can(user.role, "actions_approve_reject") || canAll;
  const canContent = can(user.role, "actions_content");

  return (
    <div>
      <Link href="/board" className="text-sm text-brand-600 hover:underline">
        ← Back to board
      </Link>

      <PageHeader
        title={`${detail.campaignId} · ${detail.title}`}
        subtitle={`${STAGE_LABELS[detail.stage]} · Launch ${fmtDate(detail.launchDate)} → End ${fmtDate(detail.endDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{STAGE_LABELS[detail.stage]}</Badge>
            {detail.paused ? <Badge tone="amber">⏸ Paused</Badge> : null}
            {detail.status === "rejected" ? <Badge tone="red">Rejected</Badge> : null}
            {detail.status === "archived" ? <Badge tone="gray">Archived</Badge> : null}
            {detail.sla.state === "needs_attention" || detail.sla.state === "locked_out" ? (
              <Badge tone="red">{detail.sla.label}</Badge>
            ) : null}
          </div>
        }
      />

      {detail.sentBack ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sent back:</strong> {detail.campaign.sent_back_reason}
        </div>
      ) : null}
      {detail.status === "paused" && detail.campaign.pause_reason ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Paused ({fmtDateTime(detail.campaign.paused_at)}):</strong> {detail.campaign.pause_reason}
        </div>
      ) : null}
      {detail.status === "rejected" && detail.campaign.reject_reason ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <strong>Rejected:</strong> {detail.campaign.reject_reason}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-6">
        {/* left column: facts + stock + history */}
        <div className="col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Brief</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Brief owner</dt>
                <dd className="font-medium text-slate-800">{detail.campaign.brief_owner}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Banner placement</dt>
                <dd className="font-medium text-slate-800">
                  {detail.campaign.banner_type ?? "—"}
                  {detail.campaign.banner_position ? ` · ${detail.campaign.banner_position}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Banner asset</dt>
                <dd className="font-medium text-slate-800">
                  {detail.campaign.banner_asset_link ? (
                    <a href={detail.campaign.banner_asset_link} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">
                      Open asset link
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Content status</dt>
                <dd>
                  <ContentBadge status={detail.contentStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Critical SKUs ({detail.criticalSkus.length})</dt>
                <dd className="font-medium text-slate-800">{detail.criticalSkus.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Normal SKUs ({detail.normalSkus.length})</dt>
                <dd className="font-medium text-slate-800">{detail.normalSkus.join(", ") || "—"}</dd>
              </div>
            </dl>
          </div>

          {/* stock readiness */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Stock readiness</h2>
              <div className="flex items-center gap-3">
                <StockBadge readiness={detail.stockReadiness} />
                <span className="text-xs text-slate-400">
                  {detail.stock.updatedAt
                    ? `Stock last updated: ${fmtDateTime(detail.stock.updatedAt)}`
                    : "No stock import yet"}
                </span>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Hero SKUs (min in-stock %)</div>
                <div className="text-lg font-bold text-slate-900">{fmtPct(detail.stock.heroPct)}</div>
                <div className="text-xs text-slate-500">Threshold 100% — below blocks Publish</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Regular SKUs (min in-stock %)</div>
                <div className="text-lg font-bold text-slate-900">{fmtPct(detail.stock.regularPct)}</div>
                <div className="text-xs text-slate-500">Threshold 90% — below shows warning</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-400">OOS SKUs</div>
                <div className="text-lg font-bold text-slate-900">{detail.stock.oosSkus}</div>
                <div className="text-xs text-slate-500">of {detail.stock.totalSkus} tracked SKU rows</div>
              </div>
            </div>

            {detail.stockRows.length === 0 ? (
              <p className="text-sm text-slate-500">No stock values imported for this campaign yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">SKU</th>
                      <th className="th">Type</th>
                      <th className="th">Depot</th>
                      <th className="th">In stock</th>
                      <th className="th">Required</th>
                      <th className="th">In-stock %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.stockRows.map((row) => {
                      const pct = row.units_required > 0 ? Math.min(100, (row.units_in_stock / row.units_required) * 100) : 100;
                      const below = row.sku_type === "Hero" ? pct < 100 : pct < 90;
                      return (
                        <tr key={row.id} className={below ? "bg-rose-50/60" : ""}>
                          <td className="td font-medium">{row.sku_code}</td>
                          <td className="td">
                            <Badge tone={row.sku_type === "Hero" ? "purple" : "gray"}>{row.sku_type}</Badge>
                          </td>
                          <td className="td">{row.depot}</td>
                          <td className="td">{row.units_in_stock}</td>
                          <td className="td">{row.units_required}</td>
                          <td className={`td font-semibold ${below ? "text-rose-600" : "text-emerald-600"}`}>
                            {fmtPct(pct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* history timeline */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Campaign history</h2>
            <ol className="relative space-y-4 border-l border-slate-200 pl-6">
              {detail.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-400" />
                  <div className="text-sm font-semibold text-slate-800">
                    {EVENT_LABELS[ev.action] ?? ev.action}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtDateTime(ev.created_at)} · {ev.actor}
                  </div>
                  {ev.reason ? <div className="mt-1 text-sm text-slate-600">{ev.reason}</div> : null}
                  {ev.details ? <div className="mt-0.5 text-xs text-slate-500">{ev.details}</div> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* right column: actions + side facts */}
        <div className="space-y-6">
          <ActionForms
            campaignPk={detail.id}
            stage={detail.stage}
            status={detail.status}
            contentStatus={detail.contentStatus}
            publishBlockedReasons={check.reasons}
            canAllActions={canAll}
            canApproveReject={canApproveReject}
            canContent={canContent}
            today={todayIso()}
          />

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">SLA status</h2>
            <div className="text-sm text-slate-700">{detail.sla.label}</div>
            {detail.sla.deadline ? (
              <div className="mt-1 text-xs text-slate-400">
                T-3 deadline: {fmtDate(detail.sla.deadline)} (3 working days before launch)
              </div>
            ) : null}
          </div>

          {detail.planning ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Planning link</h2>
              <div className="text-sm text-slate-700">
                {detail.planning.theme} · {detail.planning.period}
              </div>
              <div className="mt-1 text-xs text-slate-400">Revenue target</div>
              <div className="text-lg font-bold text-slate-900">{fmtEgp(detail.planning.revenue_target)}</div>
            </div>
          ) : null}

          {detail.performance ? (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Latest performance</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Actual revenue</dt>
                  <dd className="font-semibold text-slate-900">{fmtEgp(detail.performance.actual_revenue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">CTR</dt>
                  <dd className="font-semibold text-slate-900">{fmtPct(detail.performance.ctr)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Conversion rate</dt>
                  <dd className="font-semibold text-slate-900">{fmtPct(detail.performance.conversion_rate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">OOS incidents</dt>
                  <dd className="font-semibold text-slate-900">{detail.performance.oos_incidents}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <DataSourceLabel importedAt={detail.performance.imported_at.slice(0, 10)} />
              </div>
            </div>
          ) : null}

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              Notifications ({detail.notifications.length})
            </h2>
            {detail.notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications linked to this campaign yet.</p>
            ) : (
              <ul className="space-y-3">
                {detail.notifications.map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">{n.message_type}</span>
                      <NotificationBadge status={n.status as NotificationStatus} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.en_copy}</p>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Send: {fmtDateTime(n.planned_send_at)}
                      {n.reviewer ? ` · Reviewer: ${n.reviewer}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/notifications" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">
              Manage in Notifications →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
