// Shared UI primitives.

import Link from "next/link";
import type { ReactNode } from "react";
import type { StockReadiness, ContentStatus, NotificationStatus } from "@/lib/types";

export function Badge({
  tone,
  children,
  title,
}: {
  tone: "green" | "amber" | "red" | "gray" | "blue" | "purple";
  children: ReactNode;
  title?: string;
}) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    gray: "bg-slate-100 text-slate-600",
    blue: "bg-brand-100 text-brand-800",
    purple: "bg-violet-100 text-violet-800",
  };
  return (
    <span className={`badge ${tones[tone]}`} title={title}>
      {children}
    </span>
  );
}

export function StockBadge({ readiness }: { readiness: StockReadiness }) {
  switch (readiness) {
    case "ready":
      return <Badge tone="green">✅ Ready</Badge>;
    case "attention":
      return <Badge tone="amber">⚠️ Needs Attention</Badge>;
    case "blocked":
      return <Badge tone="red">🔴 Blocked</Badge>;
    default:
      return <Badge tone="gray">No stock data</Badge>;
  }
}

export function ContentBadge({ status }: { status: ContentStatus }) {
  switch (status) {
    case "approved":
      return <Badge tone="green">Content approved</Badge>;
    case "rejected":
      return <Badge tone="red">Content rejected</Badge>;
    default:
      return <Badge tone="amber">Awaiting review</Badge>;
  }
}

export function NotificationBadge({ status }: { status: NotificationStatus }) {
  switch (status) {
    case "approved":
      return <Badge tone="green">Approved</Badge>;
    case "rejected":
      return <Badge tone="red">Rejected</Badge>;
    case "pending_review":
      return <Badge tone="amber">Pending review</Badge>;
    default:
      return <Badge tone="gray">Draft</Badge>;
  }
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const border =
    tone === "green"
      ? "border-l-4 border-l-emerald-500"
      : tone === "red"
        ? "border-l-4 border-l-rose-500"
        : tone === "amber"
          ? "border-l-4 border-l-amber-500"
          : "border-l-4 border-l-brand-500";
  return (
    <div className={`card ${border} p-4`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DataSourceLabel({ importedAt }: { importedAt: string | null }) {
  return (
    <span className="text-xs text-slate-400">
      {importedAt ? `Manual import — ${importedAt.slice(0, 10)}` : "No import yet"}
    </span>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state) return null;
  if (state.error) {
    return (
      <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
        {state.error}
      </div>
    );
  }
  if (state.success) {
    return (
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
        {state.success}
      </div>
    );
  }
  return null;
}

export function DepotDots({
  depotStatus,
}: {
  depotStatus: Record<string, { confirmed: boolean; hasRows: boolean }>;
}) {
  const depots = ["DS_Zayed", "DS_Maadi", "DS_Kitkat"];
  return (
    <div className="flex items-center gap-2">
      {depots.map((d) => {
        const s = depotStatus[d];
        const color = s?.confirmed
          ? "bg-emerald-500"
          : s?.hasRows
            ? "bg-rose-500"
            : "bg-slate-300";
        return (
          <span key={d} className="flex items-center gap-1 text-xs text-slate-500" title={`${d}: ${s?.confirmed ? "confirmed" : s?.hasRows ? "below threshold" : "no rows"}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
            {d.replace("DS_", "")}
          </span>
        );
      })}
    </div>
  );
}

export function ForbiddenPage({ from }: { from: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-black text-brand-600">403</div>
      <h1 className="text-xl font-bold text-slate-900">Access denied</h1>
      <p className="max-w-md text-sm text-slate-500">
        Your role does not have permission to view <span className="font-semibold">{from || "this section"}</span>.
        If you believe this is an error, contact an Admin.
      </p>
      <Link href="/board" className="btn-primary">
        Back to Board
      </Link>
    </div>
  );
}
