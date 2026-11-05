// Strategic Planning layer — PRD §04. Read-only for everyone; changes require
// a new campaign-calendar import by Admin.

import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { loadAllCampaignCards } from "@/lib/queries";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate, fmtEgp, monthLabel, matchesSearch } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; theme?: string; status?: string; q?: string }>;
}) {
  const user = await requireCapability("board_view", "Planning");
  const { month = "", theme = "", status = "", q = "" } = await searchParams;

  const db = await getDb();
  const entries = await db
    .selectFrom("planning_entries")
    .selectAll()
    .orderBy("planned_launch_date")
    .execute();
  const cards = await loadAllCampaignCards(db);
  const cardByTitle = new Map(cards.map((c) => [c.title.toLowerCase(), c]));

  const themes = [...new Set(entries.map((e) => e.theme))].sort();

  // Resolve each planning entry's pipeline status via its brief (matched by title).
  const rows = entries.map((entry) => {
    const card = cardByTitle.get(entry.title.toLowerCase());
    let label: string;
    let tone: "green" | "amber" | "red" | "gray" | "blue";
    if (!card) {
      label = "Planned";
      tone = "blue";
    } else if (card.view === "rejected") {
      label = "Rejected";
      tone = "red";
    } else if (card.paused) {
      label = "Held / Paused";
      tone = "amber";
    } else if (card.stage === "live") {
      label = card.view === "board" ? "Published" : card.view === "archived" ? "Published · Archived" : "Published · Ended";
      tone = "green";
    } else {
      label = "In pipeline";
      tone = "amber";
    }
    return { entry, card, label, tone };
  });

  const filtered = rows.filter((r) => {
    if (month && r.entry.planned_launch_date.slice(0, 7) !== month) return false;
    if (theme && r.entry.theme !== theme) return false;
    if (status) {
      const s = status.toLowerCase();
      if (s === "planned" && r.label !== "Planned") return false;
      if (s === "published" && !r.label.startsWith("Published")) return false;
      if (s === "rejected" && r.label !== "Rejected") return false;
      if (s === "held" && !r.label.startsWith("Held")) return false;
    }
    if (q && !matchesSearch(`${r.entry.title} ${r.entry.theme} ${r.entry.owner}`, q)) return false;
    return true;
  });

  // group by launch month
  const groups = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const key = r.entry.planned_launch_date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const monthKeys = [...groups.keys()].sort();

  return (
    <div>
      <PageHeader
        title="Campaign calendar"
        subtitle="Yearly, quarterly and monthly plan imported by Admin. Planning data cannot be edited inline — changes require a new import."
        actions={
          can(user.role, "imports") ? (
            <Link href="/imports" className="btn-secondary">
              Import planning sheet
            </Link>
          ) : null
        }
      />

      <form className="card mb-6 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Month</label>
          <input type="month" name="month" className="input w-44" defaultValue={month} />
        </div>
        <div>
          <label className="label">Theme</label>
          <select name="theme" className="input w-48" defaultValue={theme}>
            <option value="">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" className="input w-40" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
            <option value="held">Held / Paused</option>
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <input name="q" className="input w-56" placeholder="Title, theme, owner…" defaultValue={q} />
        </div>
        <button type="submit" className="btn-primary">
          Apply filters
        </button>
      </form>

      {monthKeys.length === 0 ? (
        <EmptyState>
          No planning entries match the current filters. Import a campaign calendar sheet to populate
          the plan.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {monthKeys.map((key) => {
            const list = groups.get(key)!;
            return (
              <section key={key}>
                <h2 className="mb-3 text-lg font-bold text-slate-900">{monthLabel(key)}</h2>
                <div className="overflow-x-auto card">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th">Campaign</th>
                        <th className="th">Theme</th>
                        <th className="th">Period</th>
                        <th className="th">Planned dates</th>
                        <th className="th">Revenue target</th>
                        <th className="th">Owner</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map(({ entry, card, label, tone }) => (
                        <tr key={entry.id}>
                          <td className="td">
                            <div className="font-semibold text-slate-900">{entry.title}</div>
                            {entry.notes ? <div className="text-xs text-slate-400">{entry.notes}</div> : null}
                          </td>
                          <td className="td">
                            <Badge tone="purple">{entry.theme}</Badge>
                          </td>
                          <td className="td">{entry.period}</td>
                          <td className="td">
                            {fmtDate(entry.planned_launch_date)} → {fmtDate(entry.planned_end_date)}
                          </td>
                          <td className="td font-semibold">{fmtEgp(entry.revenue_target)}</td>
                          <td className="td">{entry.owner}</td>
                          <td className="td">
                            {card ? (
                              <Link href={`/board/${card.id}`} className="hover:underline">
                                <Badge tone={tone}>{label}</Badge>
                              </Link>
                            ) : (
                              <Badge tone={tone}>{label}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
