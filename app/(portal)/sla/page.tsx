// SLA dashboard — PRD §05/§12. Turnaround per team + campaign-level
// compliance. Breaches are stored permanently in compliance history.

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { loadAllCampaignCards } from "@/lib/queries";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { addWorkingDays, fmtDate, parseDate, today, workingDaysBetween } from "@/lib/format";
import type { CampaignRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function daysBetween(aIso: string | null, bIso: string): number | null {
  if (!aIso) return null;
  return Math.max(0, Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 86400000));
}

export default async function SlaPage() {
  await requireCapability("board_full", "SLA dashboard");
  const db = await getDb();
  const campaigns = await db.selectFrom("campaigns").selectAll().orderBy("launch_date").execute();
  const cards = await loadAllCampaignCards(db);
  const cardById = new Map(cards.map((c) => [c.id, c]));

  const nowIso = new Date().toISOString();

  // --- per-team turnaround (from stored stage timestamps) -------------------
  const spans: Record<string, number[]> = {
    Procurement: [],
    Hub: [],
    DS_Zayed: [],
    DS_Maadi: [],
    DS_Kitkat: [],
    Content: [],
    Marketing: [],
  };
  const pending: Record<string, { count: number; waitDays: number[] }> = {};
  for (const key of Object.keys(spans)) pending[key] = { count: 0, waitDays: [] };

  for (const c of campaigns) {
    if (c.status === "rejected") continue;
    // Procurement: brief → accepted
    if (c.accepted_at) {
      const d = daysBetween(c.created_at, c.accepted_at);
      if (d !== null) spans.Procurement.push(d);
    } else if (c.stage === "in_pipeline") {
      pending.Procurement.count++;
      const d = daysBetween(c.created_at, nowIso);
      if (d !== null) pending.Procurement.waitDays.push(d);
    }
    // Hub: accepted → hub confirmed
    if (c.hub_confirmed_at && c.accepted_at) {
      const d = daysBetween(c.accepted_at, c.hub_confirmed_at);
      if (d !== null) spans.Hub.push(d);
    } else if (c.stage === "hub_pending") {
      pending.Hub.count++;
      const d = daysBetween(c.accepted_at ?? c.created_at, nowIso);
      if (d !== null) pending.Hub.waitDays.push(d);
    }
    // Depots (proxy: accepted → depots confirmed split per depot via stock rows import time)
    const stockRows = await db.selectFrom("stock_rows").selectAll().where("campaign_pk", "=", c.id).execute();
    for (const depot of ["DS_Zayed", "DS_Maadi", "DS_Kitkat"] as const) {
      const depotRows = stockRows.filter((r) => r.depot === depot);
      const confirmedAt = depotRows.length
        ? depotRows.map((r) => r.imported_at).sort().pop()!
        : null;
      if (confirmedAt && c.accepted_at) {
        const d = daysBetween(c.accepted_at, confirmedAt);
        if (d !== null) spans[depot].push(d);
      } else if (c.stage === "depots_pending" || c.stage === "hub_pending") {
        pending[depot].count++;
        const d = daysBetween(c.accepted_at ?? c.created_at, nowIso);
        if (d !== null) pending[depot].waitDays.push(d);
      }
    }
    // Content: depots confirmed → content approved
    if (c.content_approved_at && (c.depots_confirmed_at || c.accepted_at)) {
      const d = daysBetween(c.depots_confirmed_at ?? c.accepted_at, c.content_approved_at);
      if (d !== null) spans.Content.push(d);
    } else if (c.stage === "content_pending" && c.content_status !== "approved") {
      pending.Content.count++;
      const d = daysBetween(c.depots_confirmed_at ?? c.accepted_at ?? c.created_at, nowIso);
      if (d !== null) pending.Content.waitDays.push(d);
    }
    // Marketing: campaigns sent back over stock issues
    if (c.sent_back_reason) {
      pending.Marketing.count++;
    }
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  // --- campaign-level compliance -------------------------------------------
  const campaignRows = campaigns
    .filter((c) => c.status !== "archived")
    .map((c) => {
      const card = cardById.get(c.id);
      const deadline = addWorkingDays(parseDate(c.launch_date), -3);
      const stageStatus = (doneIso: string | null, tracked: boolean) => {
        if (!tracked) return { text: "—", tone: "gray" as const };
        const done = doneIso ? new Date(doneIso) : today();
        const overdue = workingDaysBetween(deadline, done);
        if (overdue <= 0) return { text: "On time", tone: "green" as const };
        return { text: `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`, tone: "red" as const };
      };
      const hubTracked = ["hub_pending", "depots_pending", "content_pending", "live"].includes(c.stage) || Boolean(c.hub_confirmed_at);
      const depotTracked = ["depots_pending", "content_pending", "live"].includes(c.stage) || Boolean(c.depots_confirmed_at);
      return {
        c,
        deadline,
        hub: stageStatus(c.hub_confirmed_at, hubTracked),
        depots: stageStatus(c.depots_confirmed_at, depotTracked),
        content:
          c.content_status === "approved"
            ? { text: "Approved", tone: "green" as const }
            : c.stage === "live"
              ? { text: "Approved", tone: "green" as const }
              : { text: "Pending", tone: "amber" as const },
        overall: card?.sla ?? null,
      };
    });

  const teams = [
    ["Procurement", "Brief review & acceptance"],
    ["Hub", "Hub stock verification"],
    ["DS_Zayed", "Zayed depot confirmation"],
    ["DS_Maadi", "Maadi depot confirmation"],
    ["DS_Kitkat", "Kitkat depot confirmation"],
    ["Content", "Banner & notification approval"],
    ["Marketing", "Sent-back / stock issues"],
  ] as const;

  return (
    <div>
      <PageHeader
        title="SLA dashboard"
        subtitle="Average turnaround per team, pending counts, and campaign-level compliance. T-3 = must complete 3 working days before launch. Breaches are kept permanently in compliance history."
      />

      <div className="overflow-x-auto card">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Team</th>
              <th className="th">Responsibility</th>
              <th className="th">Completed stages</th>
              <th className="th">Avg turnaround</th>
              <th className="th">Pending now</th>
              <th className="th">Avg waiting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teams.map(([team, resp]) => {
              const s = spans[team];
              const p = pending[team];
              return (
                <tr key={team}>
                  <td className="td font-semibold text-slate-900">{team}</td>
                  <td className="td text-slate-500">{resp}</td>
                  <td className="td">{s.length}</td>
                  <td className="td">{avg(s) !== null ? `${avg(s)!.toFixed(1)} days` : "—"}</td>
                  <td className="td">{p.count > 0 ? <Badge tone="amber">{p.count}</Badge> : "0"}</td>
                  <td className="td">{avg(p.waitDays) !== null ? `${avg(p.waitDays)!.toFixed(1)} days` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Campaign-level compliance</h2>
      {campaignRows.length === 0 ? (
        <EmptyState>No campaigns to track.</EmptyState>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Campaign</th>
                <th className="th">T-3 deadline</th>
                <th className="th">Hub stage</th>
                <th className="th">Depots stage</th>
                <th className="th">Content</th>
                <th className="th">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaignRows.map((r) => (
                <tr key={r.c.id}>
                  <td className="td">
                    <div className="font-semibold text-slate-900">{r.c.title}</div>
                    <div className="text-xs text-slate-400">{r.c.campaign_id} · launch {fmtDate(r.c.launch_date)}</div>
                  </td>
                  <td className="td">{fmtDate(r.deadline.toISOString())}</td>
                  <td className="td">
                    <Badge tone={r.hub.tone}>{r.hub.text}</Badge>
                  </td>
                  <td className="td">
                    <Badge tone={r.depots.tone}>{r.depots.text}</Badge>
                  </td>
                  <td className="td">
                    <Badge tone={r.content.tone}>{r.content.text}</Badge>
                  </td>
                  <td className="td">
                    {r.overall && r.overall.state !== "none" && r.overall.state !== "on_time" ? (
                      <Badge tone="red">{r.overall.label}</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        SLA breaches are recorded permanently and cannot be edited or deleted — they form the
        compliance history used in monthly reviews.
      </p>
    </div>
  );
}
