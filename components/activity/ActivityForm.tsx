"use client";

// Log entry form — PRD §09. Owner auto-filled and locked on the server.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/app/actions/activity";
import type { ActionState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui";
import { todayIso } from "@/lib/format";

export default function ActivityForm({
  campaigns,
  actionTypes,
}: {
  campaigns: { id: number; label: string }[];
  actionTypes: string[];
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = (formData: FormData) => {
    formData.delete("campaign_pks");
    for (const id of selected) formData.append("campaign_pks", String(id));
    startTransition(async () => {
      const result = await createActivityAction(state ?? {}, formData);
      setState(result);
      if (result.success) {
        setSelected([]);
        router.refresh();
      }
    });
  };

  return (
    <form action={submit} className="card space-y-4 p-5">
      <h3 className="text-sm font-bold text-slate-900">Log an optimization action</h3>
      <FormMessage state={state} />

      <div>
        <label className="label">Date *</label>
        <input type="date" name="date" className="input" defaultValue={todayIso()} required />
      </div>

      <div>
        <label className="label">Action type *</label>
        <select name="action_type" className="input" required>
          <option value="">Select…</option>
          {actionTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Campaign association * (one or more)</label>
        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {campaigns.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-slate-300"
              />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {selected.length} selected{selected.length === 0 ? " — at least one required" : ""}
        </p>
      </div>

      <div>
        <label className="label">Description * (what was done and why)</label>
        <textarea name="description" className="input" rows={3} required />
      </div>

      <div>
        <label className="label">Impact observed (optional)</label>
        <input name="impact" className="input" placeholder='e.g. "CTR +12% next day"' />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending || selected.length === 0}>
        {pending ? "Logging…" : "Log action"}
      </button>
    </form>
  );
}
