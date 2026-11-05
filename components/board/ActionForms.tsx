"use client";

// Campaign action buttons + input forms — PRD §07.
// Availability rules mirror the PRD exactly; disabled buttons show which
// condition blocks them.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { campaignAction, type CampaignAction } from "@/app/actions/campaigns";
import type { ActionState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui";

interface Props {
  campaignPk: number;
  stage: string;
  status: string;
  contentStatus: string;
  publishBlockedReasons: string[];
  canAllActions: boolean;
  canApproveReject: boolean;
  canContent: boolean;
  today: string;
}

export default function ActionForms(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<CampaignAction | null>(null);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: CampaignAction, formData: FormData) => {
    formData.set("action", action);
    formData.set("campaign_pk", String(props.campaignPk));
    startTransition(async () => {
      const result = await campaignAction(state ?? {}, formData);
      setState(result);
      if (result.success) {
        setOpen(null);
        router.refresh();
      }
    });
  };

  const isLive = props.stage === "live" && props.status !== "archived";
  const isPaused = props.status === "paused";
  const beforeLive = props.stage !== "live";
  const publishAllowed = props.publishBlockedReasons.length === 0 && !isPaused;

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-sm font-bold text-slate-900">Actions</h2>
      <p className="mb-4 text-xs text-slate-500">
        Actions are taken here — not from the board card.
      </p>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        {/* --- Publish --- */}
        {props.canAllActions ? (
          <div className="flex flex-col items-start">
            <button
              type="button"
              className="btn-primary"
              disabled={!publishAllowed || pending}
              title={publishAllowed ? "Publish campaign" : props.publishBlockedReasons.join(" ")}
              onClick={() => setOpen(open === "publish" ? null : "publish")}
            >
              🟢 Publish
            </button>
            {!publishAllowed ? (
              <div className="mt-1 max-w-[15rem] text-[11px] leading-snug text-rose-600">
                {props.publishBlockedReasons.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --- Accept brief (Procurement gate) --- */}
        {props.canApproveReject && props.stage === "in_pipeline" ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => setOpen(open === "accept_brief" ? null : "accept_brief")}
          >
            ✓ Accept brief
          </button>
        ) : null}

        {/* --- Reject --- */}
        {props.canApproveReject && beforeLive ? (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() => setOpen(open === "reject" ? null : "reject")}
          >
            🔴 Reject
          </button>
        ) : null}

        {/* --- Hold & Set New Date --- */}
        {props.canAllActions && beforeLive ? (
          <button
            type="button"
            className="btn-amber"
            disabled={pending}
            onClick={() => setOpen(open === "hold" ? null : "hold")}
          >
            🟡 Hold &amp; set new date
          </button>
        ) : null}

        {/* --- Pause / Resume --- */}
        {props.canAllActions && isLive && !isPaused ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => setOpen(open === "pause" ? null : "pause")}
          >
            ⏸ Pause
          </button>
        ) : null}
        {props.canAllActions && isPaused ? (
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => setOpen(open === "resume" ? null : "resume")}
          >
            ▶ Resume
          </button>
        ) : null}

        {/* --- Content track --- */}
        {props.canContent || props.canAllActions ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || props.contentStatus === "approved"}
              onClick={() => setOpen(open === "content_approve" ? null : "content_approve")}
            >
              ✔ Approve content
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() => setOpen(open === "content_reject" ? null : "content_reject")}
            >
              ✖ Reject content
            </button>
          </>
        ) : null}

        {/* --- Take down (Content) --- */}
        {(props.canContent || props.canAllActions) && isLive ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => setOpen(open === "take_down" ? null : "take_down")}
          >
            ⤓ Mark taken down
          </button>
        ) : null}

        {/* --- Send back over stock --- */}
        {props.canAllActions && beforeLive ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => setOpen(open === "send_back" ? null : "send_back")}
          >
            ↩ Send back
          </button>
        ) : null}
      </div>

      {/* --- action input forms --- */}
      {open === "publish" ? (
        <form action={(fd) => run("publish", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm text-slate-700">
            Publish this campaign now? It becomes visible in the app immediately.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Publishing…" : "Confirm publish"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "accept_brief" ? (
        <form action={(fd) => run("accept_brief", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm text-slate-700">
            Accept this brief and start the stock verification track (Hub Pending)?
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              Accept brief
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "reject" ? (
        <form action={(fd) => run("reject", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">Rejection reason (required)</label>
          <textarea name="reason" className="input mb-3" rows={2} required placeholder="Why is this campaign rejected?" />
          <div className="flex gap-2">
            <button type="submit" className="btn-danger" disabled={pending}>
              Reject &amp; archive
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "hold" ? (
        <form action={(fd) => run("hold", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">New launch date (required, today or later)</label>
          <input type="date" name="new_launch_date" className="input mb-3" min={props.today} required />
          <label className="label">Reason (optional)</label>
          <textarea name="reason" className="input mb-3" rows={2} />
          <div className="flex gap-2">
            <button type="submit" className="btn-amber" disabled={pending}>
              Hold campaign
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "pause" ? (
        <form action={(fd) => run("pause", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">Pause reason (required)</label>
          <textarea name="reason" className="input mb-3" rows={2} required placeholder="Why is the campaign being paused?" />
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary" disabled={pending}>
              Pause campaign
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "resume" ? (
        <form action={(fd) => run("resume", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm text-slate-700">Resume this campaign back to Live?</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              Resume
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "content_approve" ? (
        <form action={(fd) => run("content_approve", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">Note (optional)</label>
          <textarea name="reason" className="input mb-3" rows={2} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              Approve banner &amp; notifications
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "content_reject" ? (
        <form action={(fd) => run("content_reject", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">Note (required)</label>
          <textarea name="reason" className="input mb-3" rows={2} required placeholder="What needs to change?" />
          <div className="flex gap-2">
            <button type="submit" className="btn-danger" disabled={pending}>
              Reject content
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "take_down" ? (
        <form action={(fd) => run("take_down", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm text-slate-700">
            Mark the banner as taken down — the campaign moves to Archive (Campaign History).
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              Confirm taken down
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {open === "send_back" ? (
        <form action={(fd) => run("send_back", fd)} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="label">Reason (required)</label>
          <textarea name="reason" className="input mb-3" rows={2} required placeholder="e.g. stock issue — SKU unavailable" />
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary" disabled={pending}>
              Send back to In Pipeline
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
