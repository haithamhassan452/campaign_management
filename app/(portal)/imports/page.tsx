// Sheet imports — PRD §11. Admin only. All-or-nothing validation per import.

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { IMPORT_TYPE_LABELS } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import ImportForm from "@/components/imports/ImportForm";

export const dynamic = "force-dynamic";

const SPECS = {
  campaign_calendar: {
    title: IMPORT_TYPE_LABELS.campaign_calendar,
    description: "Adds / updates planned campaigns in the planning layer. Rows with the same title + launch date update the existing entry.",
    columns: [
      ["Campaign title", "Text", "Required · unique identifier for the campaign"],
      ["Theme / category", "Text", "Required · e.g. Ramadan, Back to School, P&G brand push"],
      ["Planning period", "Dropdown", "Required · Yearly / Quarterly / Monthly"],
      ["Planned launch date", "Date", "Required · YYYY-MM-DD"],
      ["Planned end date", "Date", "Required · must be after launch date"],
      ["Revenue target (EGP)", "Number", "Required · primary KPI for performance analysis"],
      ["Campaign owner", "Text", "Required · Growth Manager or Supervisor name"],
      ["Notes", "Text", "Optional · strategic context"],
    ],
  },
  stock_values: {
    title: IMPORT_TYPE_LABELS.stock_values,
    description: "Updates stock readiness per campaign per SKU. Previous rows for each campaign in the sheet are replaced (not appended). Readiness is recalculated immediately.",
    columns: [
      ["Campaign ID", "Text", "Required · must match an existing CMP-XXXX"],
      ["SKU code", "Text", "Required · must match catalogue SKU"],
      ["SKU type", "Hero / Regular", "Required · determines which threshold applies"],
      ["Units in stock", "Number", "Required · current available units"],
      ["Units required", "Number", "Required · portal calculates in-stock %"],
      ["Depot", "Hub / DS_Zayed / DS_Maadi / DS_Kitkat", "Required · readiness shown per location"],
    ],
  },
  performance_results: {
    title: IMPORT_TYPE_LABELS.performance_results,
    description: "Adds post-campaign revenue and metric data. Re-importing the same campaign + period updates the previous result.",
    columns: [
      ["Campaign ID", "Text", "Required · must match CMP-XXXX in portal"],
      ["Actual revenue (EGP)", "Number", "Required · total sales attributed to the campaign"],
      ["CTR (%)", "Decimal", "Optional in Phase 1"],
      ["Conversion rate (%)", "Decimal", "Optional in Phase 1"],
      ["OOS incidents", "Number", "Required · count of SKUs that went OOS during campaign"],
      ["Reporting period", "Date", "Required · month/year the results cover (e.g. 2026-11 or 11/2026)"],
    ],
  },
} as const;

export default async function ImportsPage() {
  await requireCapability("imports", "Sheet imports");
  const db = await getDb();
  const history = await db
    .selectFrom("import_history")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(25)
    .execute();

  return (
    <div>
      <PageHeader
        title="Sheet imports"
        subtitle="All imports are Admin-only and validate every row before committing — partial imports are never applied. On error, fix the sheet and re-import."
      />

      <div className="space-y-8">
        {(Object.keys(SPECS) as (keyof typeof SPECS)[]).map((key) => {
          const spec = SPECS[key];
          return (
            <section key={key} className="card p-6">
              <h2 className="text-base font-bold text-slate-900">{spec.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{spec.description}</p>

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Column</th>
                      <th className="th">Type</th>
                      <th className="th">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {spec.columns.map(([col, type, notes]) => (
                      <tr key={col}>
                        <td className="td font-medium text-slate-900">{col}</td>
                        <td className="td">{type}</td>
                        <td className="td text-slate-500">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <ImportForm importType={key} label={spec.title} />
              </div>
            </section>
          );
        })}
      </div>

      {/* Import history */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Import history</h2>
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Import type</th>
                <th className="th">Date &amp; time</th>
                <th className="th">Admin</th>
                <th className="th">Rows</th>
                <th className="th">Status</th>
                <th className="th">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="td font-medium">{IMPORT_TYPE_LABELS[h.import_type]}</td>
                  <td className="td">{fmtDateTime(h.created_at)}</td>
                  <td className="td">{h.admin_username}</td>
                  <td className="td">{h.row_count}</td>
                  <td className="td">
                    {h.status === "success" ? (
                      <Badge tone="green">Success</Badge>
                    ) : (
                      <Badge tone="red">Rejected</Badge>
                    )}
                  </td>
                  <td className="td max-w-md whitespace-pre-wrap text-xs text-rose-600">
                    {h.error_report ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
