"use client";

// Notification list + create form + review actions. Live character counters
// turn red when copy exceeds the limit (PRD §08).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createNotificationAction,
  notificationStatusAction,
} from "@/app/actions/notifications";
import type { ActionState } from "@/app/actions/auth";
import { Badge, FormMessage, NotificationBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

interface Item {
  id: number;
  message_type: string;
  campaign_pk: number | null;
  ar_copy: string;
  en_copy: string;
  planned_send_at: string;
  target_segment: string | null;
  status: string;
  reviewer: string | null;
  review_note: string | null;
  created_by: string;
  campaign: {
    id: number;
    campaign_id: string;
    title: string;
    stage: string;
    status: string;
    end_date: string;
  } | null;
}

interface CampaignOption {
  id: number;
  campaign_id: string;
  title: string;
}

interface Props {
  items: Item[];
  campaigns: CampaignOption[];
  canManage: boolean;
  currentUsername: string;
  isGlobal: boolean;
  messageTypes: string[];
  copyLimits: Record<string, number>;
}

function CharCounter({ text, limit }: { text: string; limit: number }) {
  const over = text.length > limit;
  return (
    <span className={`text-xs font-medium ${over ? "text-rose-600" : "text-emerald-600"}`}>
      {text.length} / {limit}
    </span>
  );
}

export default function NotificationsClient(props: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [messageType, setMessageType] = useState(props.messageTypes[0]);
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [campaignPk, setCampaignPk] = useState("");

  const limit = props.copyLimits[messageType] ?? 150;
  const overLimit = ar.length > limit || en.length > limit;
  const canSave = ar.trim() && en.trim() && !overLimit && (props.isGlobal || campaignPk);

  const submitCreate = (formData: FormData) => {
    if (props.isGlobal) formData.set("is_global", "on");
    startTransition(async () => {
      const result = await createNotificationAction(state ?? {}, formData);
      setState(result);
      if (result.success) {
        setShowForm(false);
        setAr("");
        setEn("");
        router.refresh();
      }
    });
  };

  const runStatus = (id: number, next: string, note: string) => {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("next", next);
    fd.set("note", note);
    startTransition(async () => {
      const result = await notificationStatusAction(state ?? {}, fd);
      setState(result);
      router.refresh();
    });
  };

  return (
    <div>
      <FormMessage state={state} />

      {props.canManage ? (
        <div className="mb-6">
          {!showForm ? (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              + New {props.isGlobal ? "global notification" : "campaign notification"}
            </button>
          ) : (
            <form action={submitCreate} className="card space-y-4 p-5">
              <h3 className="text-sm font-bold text-slate-900">
                New {props.isGlobal ? "global" : "campaign-linked"} notification
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Message type *</label>
                  <select
                    name="message_type"
                    className="input"
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                  >
                    {props.messageTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {!props.isGlobal ? (
                  <div>
                    <label className="label">Campaign association *</label>
                    <select
                      name="campaign_pk"
                      className="input"
                      value={campaignPk}
                      onChange={(e) => setCampaignPk(e.target.value)}
                      required
                    >
                      <option value="">Select a campaign…</option>
                      {props.campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.campaign_id} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="label">Target segment</label>
                    <input name="target_segment" className="input" placeholder='e.g. "All users", "Zamalek segment"' />
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">Arabic copy *</label>
                  <CharCounter text={ar} limit={limit} />
                </div>
                <textarea
                  name="ar_copy"
                  className="input"
                  rows={2}
                  dir="rtl"
                  value={ar}
                  onChange={(e) => setAr(e.target.value)}
                  required
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">English copy *</label>
                  <CharCounter text={en} limit={limit} />
                </div>
                <textarea
                  name="en_copy"
                  className="input"
                  rows={2}
                  value={en}
                  onChange={(e) => setEn(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Planned send date &amp; time *</label>
                  <input type="datetime-local" name="planned_send_at" className="input" required />
                  {props.isGlobal ? null : (
                    <p className="mt-1 text-xs text-slate-400">Must be before campaign go-live.</p>
                  )}
                </div>
                {props.isGlobal ? (
                  <div />
                ) : (
                  <div>
                    <label className="label">Target segment</label>
                    <input name="target_segment" className="input" placeholder='e.g. "All users", "Zamalek segment"' />
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <button type="submit" className="btn-primary" disabled={!canSave || pending}>
                  {pending ? "Saving…" : "Save as draft"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <div className="space-y-4">
        {props.items.map((item) => (
          <div key={item.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="purple">{item.message_type}</Badge>
                  <NotificationBadge status={item.status as never} />
                  {item.campaign ? (
                    <Badge tone="blue">
                      {item.campaign.campaign_id} · {item.campaign.title}
                    </Badge>
                  ) : (
                    <Badge tone="gray">Global</Badge>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-slate-800" dir="rtl">
                    {item.ar_copy}
                  </p>
                  <p className="text-sm text-slate-600">{item.en_copy}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-400">
                  <span>Send: {fmtDateTime(item.planned_send_at)}</span>
                  {item.target_segment ? <span>Segment: {item.target_segment}</span> : null}
                  <span>By: {item.created_by}</span>
                  {item.reviewer ? <span>Reviewer: {item.reviewer}</span> : null}
                </div>
                {item.review_note ? (
                  <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <strong>Review note:</strong> {item.review_note}
                  </div>
                ) : null}
              </div>

              {props.canManage ? (
                <div className="flex flex-col gap-2">
                  {item.status === "draft" &&
                  (item.created_by === props.currentUsername || true) ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={pending}
                      onClick={() => runStatus(item.id, "pending_review", "")}
                    >
                      Submit for review
                    </button>
                  ) : null}
                  {item.status === "pending_review" ? (
                    <ReviewButtons id={item.id} pending={pending} onReview={runStatus} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewButtons({
  id,
  pending,
  onReview,
}: {
  id: number;
  pending: boolean;
  onReview: (id: number, next: string, note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (rejecting) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <textarea
          className="input mb-2"
          rows={2}
          placeholder="Review note (required to reject)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-danger"
            disabled={pending || !note.trim()}
            onClick={() => onReview(id, "rejected", note)}
          >
            Confirm reject
          </button>
          <button type="button" className="btn-secondary" onClick={() => setRejecting(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => onReview(id, "approved", "")}
      >
        Approve
      </button>
      <button type="button" className="btn-danger" disabled={pending} onClick={() => setRejecting(true)}>
        Reject
      </button>
    </>
  );
}
