"use client";

// New brief form — PRD §05. Submit stays disabled until Title, Launch date,
// End date and at least one Critical SKU are filled.

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { submitBriefAction } from "@/app/actions/campaigns";
import type { ActionState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui";

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={!ready || pending}>
      {pending ? "Submitting…" : "Submit brief"}
    </button>
  );
}

export default function BriefForm({ minDate, bannerTypes }: { minDate: string; bannerTypes: string[] }) {
  const [state, formAction] = useFormState<ActionState, FormData>(submitBriefAction, {});
  const [title, setTitle] = useState("");
  const [launch, setLaunch] = useState("");
  const [end, setEnd] = useState("");
  const [critical, setCritical] = useState("");

  const criticalCount = critical.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;
  const ready = Boolean(title.trim() && launch && end && criticalCount > 0);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <FormMessage state={state} />

      <div>
        <label className="label">Campaign title *</label>
        <input name="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Launch date *</label>
          <input
            type="date"
            name="launch_date"
            className="input"
            min={minDate}
            value={launch}
            onChange={(e) => setLaunch(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-400">Must be today or later.</p>
        </div>
        <div>
          <label className="label">End date *</label>
          <input
            type="date"
            name="end_date"
            className="input"
            min={launch || minDate}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-400">Must be after launch date.</p>
        </div>
      </div>

      <div>
        <label className="label">Critical SKUs * (min 1)</label>
        <textarea
          name="critical_skus"
          className="input"
          rows={2}
          placeholder="SKU-1001, SKU-1002, …"
          value={critical}
          onChange={(e) => setCritical(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          Comma or newline separated. At least one critical SKU is required to submit.
          {criticalCount > 0 ? ` (${criticalCount} entered)` : ""}
        </p>
      </div>

      <div>
        <label className="label">Normal SKUs (optional)</label>
        <textarea name="normal_skus" className="input" rows={2} placeholder="SKU-2001, SKU-2002, …" />
        <p className="mt-1 text-xs text-slate-400">Recorded but not a launch gate.</p>
      </div>

      <div>
        <label className="label">Banner asset link (optional)</label>
        <input name="banner_asset_link" className="input" placeholder="https://drive.google.com/…" />
        <p className="mt-1 text-xs text-slate-400">Can be added later.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Banner type (optional)</label>
          <select name="banner_type" className="input" defaultValue="">
            <option value="">—</option>
            {bannerTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Banner position (optional)</label>
          <input name="banner_position" className="input" placeholder="e.g. Homepage Slider 1" />
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
        <SubmitButton ready={ready} />
        <Link href="/board" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
