"use server";

// Campaign lifecycle actions — PRD §05/§07.
// All actions are taken from the campaign detail panel (not the board card).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, nowIso, todayIso } from "@/lib/db";
import { getSessionUser, logEvent, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { summarizeStock, publishCheck } from "@/lib/campaigns";
import type { Stage } from "@/lib/types";
import type { ActionState } from "./auth";

async function guard(allowed: ("actions_all" | "actions_approve_reject" | "actions_content" | "brief_create")[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!allowed.some((a) => can(user.role, a))) redirect("/403?from=board");
  return user;
}

export async function submitBriefAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await guard(["brief_create"]);
  const title = String(formData.get("title") ?? "").trim();
  const launch = String(formData.get("launch_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  const critical = String(formData.get("critical_skus") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const normal = String(formData.get("normal_skus") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bannerLink = String(formData.get("banner_asset_link") ?? "").trim();
  const bannerType = String(formData.get("banner_type") ?? "").trim();
  const bannerPosition = String(formData.get("banner_position") ?? "").trim();

  if (!title) return { error: "Campaign title cannot be blank." };
  if (!launch) return { error: "Launch date is required." };
  if (launch < todayIso()) return { error: "Launch date must be today or later." };
  if (!end) return { error: "End date is required." };
  if (end <= launch) return { error: "End date must be after launch date." };
  if (critical.length === 0) return { error: "At least one Critical SKU is required to submit." };

  const db = await getDb();
  const last = await db
    .selectFrom("campaigns")
    .select("campaign_id")
    .orderBy("id", "desc")
    .executeTakeFirst();
  const nextNum = last ? Number(last.campaign_id.replace("CMP-", "")) + 1 : 1001;
  const campaignId = `CMP-${nextNum}`;
  const now = nowIso();

  const inserted = await db
    .insertInto("campaigns")
    .values({
      campaign_id: campaignId,
      title,
      launch_date: launch,
      end_date: end,
      critical_skus: JSON.stringify(critical),
      normal_skus: JSON.stringify(normal),
      banner_asset_link: bannerLink || null,
      banner_type: bannerType || null,
      banner_position: bannerPosition || null,
      brief_owner: user.username,
      stage: "in_pipeline",
      content_status: "awaiting",
      content_note: null,
      stock_readiness: "no_data",
      stock_updated_at: null,
      sent_back_reason: null,
      pause_reason: null,
      reject_reason: null,
      status: "active",
      created_at: now,
    })
    .executeTakeFirst();

  const pk = Number(inserted.insertId ?? 0);
  await logEvent(db, pk, "brief_submitted", user.username, null, `Brief submitted — ${critical.length} critical SKU(s).`);
  revalidatePath("/", "layout");
  redirect(`/board/${pk}?created=1`);
}

export type CampaignAction =
  | "accept_brief"
  | "send_back"
  | "publish"
  | "reject"
  | "hold"
  | "pause"
  | "resume"
  | "content_approve"
  | "content_reject"
  | "take_down";

export async function campaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const action = String(formData.get("action") ?? "") as CampaignAction;
  const pk = Number(formData.get("campaign_pk") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  const newDate = String(formData.get("new_launch_date") ?? "").trim();

  const db = await getDb();
  const campaign = await db.selectFrom("campaigns").selectAll().where("id", "=", pk).executeTakeFirst();
  if (!campaign) return { error: "Campaign not found." };

  const isAdmin = user.role === "admin";
  const isGM = user.role === "growth_manager";
  const isSupervisor = user.role === "growth_supervisor";
  const isContent = user.role === "content_team";
  const allActions = isAdmin || isGM;
  const approveReject = allActions || isSupervisor;

  const now = nowIso();
  const stockRows = await db.selectFrom("stock_rows").selectAll().where("campaign_pk", "=", pk).execute();
  const stock = summarizeStock(stockRows);

  switch (action) {
    case "accept_brief": {
      if (!approveReject) return { error: "You are not allowed to accept briefs." };
      if (campaign.stage !== "in_pipeline") return { error: "Only campaigns In Pipeline can be accepted." };
      await db.updateTable("campaigns").set({
        stage: "hub_pending",
        accepted_at: now,
        sent_back_reason: null,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "brief_accepted", user.username, null, "Procurement accepted brief — stock check started.");
      break;
    }
    case "send_back": {
      if (!allActions && !isSupervisor && !isAdmin) return { error: "You are not allowed to send campaigns back." };
      if (!reason) return { error: "A reason is required to send a campaign back." };
      await db.updateTable("campaigns").set({
        stage: "in_pipeline",
        sent_back_reason: reason,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "sent_back", user.username, reason, null);
      break;
    }
    case "publish": {
      if (!allActions) return { error: "Only Admin or Growth Manager can publish." };
      const check = publishCheck(campaign, stock);
      if (!check.allowed) return { error: `Cannot publish: ${check.reasons.join(" ")}` };
      await db.updateTable("campaigns").set({
        stage: "live",
        status: "active",
        published_at: now,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "published", user.username, null, "Campaign published — live in app.");
      break;
    }
    case "reject": {
      if (!approveReject) return { error: "You are not allowed to reject campaigns." };
      if (campaign.stage === "live") return { error: "Live campaigns cannot be rejected." };
      if (!reason) return { error: "A rejection reason is required." };
      await db.updateTable("campaigns").set({
        status: "rejected",
        reject_reason: reason,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "rejected", user.username, reason, null);
      break;
    }
    case "hold": {
      if (!allActions) return { error: "Only Admin or Growth Manager can hold campaigns." };
      if (campaign.stage === "live") return { error: "Live campaigns cannot be held — use Pause." };
      if (!newDate) return { error: "A new launch date is required." };
      if (newDate < todayIso()) return { error: "New launch date must be today or later." };
      await db.updateTable("campaigns").set({
        launch_date: newDate,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "hold", user.username, reason || null, `Launch date moved to ${newDate}.`);
      break;
    }
    case "pause": {
      if (!allActions) return { error: "Only Admin or Growth Manager can pause campaigns." };
      if (campaign.stage !== "live") return { error: "Pause is available on Live campaigns only." };
      if (!reason) return { error: "A pause reason is required." };
      await db.updateTable("campaigns").set({
        status: "paused",
        pause_reason: reason,
        paused_at: now,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "paused", user.username, reason, null);
      break;
    }
    case "resume": {
      if (!allActions) return { error: "Only Admin or Growth Manager can resume campaigns." };
      if (campaign.status !== "paused") return { error: "Campaign is not paused." };
      await db.updateTable("campaigns").set({
        status: "active",
        pause_reason: null,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "resumed", user.username, null, "Campaign resumed — back to Live.");
      break;
    }
    case "content_approve": {
      if (!can(user.role, "actions_content") && !allActions) return { error: "You are not allowed to approve content." };
      await db.updateTable("campaigns").set({
        content_status: "approved",
        content_approved_at: now,
        content_note: reason || null,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "content_approved", user.username, reason || null, null);
      break;
    }
    case "content_reject": {
      if (!can(user.role, "actions_content") && !allActions) return { error: "You are not allowed to reject content." };
      if (!reason) return { error: "A note is required when rejecting content." };
      await db.updateTable("campaigns").set({
        content_status: "rejected",
        content_note: reason,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "content_rejected", user.username, reason, null);
      break;
    }
    case "take_down": {
      if (!can(user.role, "actions_content") && !allActions) return { error: "Only Content Team can mark campaigns as taken down." };
      if (campaign.stage !== "live") return { error: "Only Live campaigns can be taken down." };
      await db.updateTable("campaigns").set({
        taken_down_at: now,
        status: "archived",
        archived_at: now,
      }).where("id", "=", pk).execute();
      await logEvent(db, pk, "taken_down", user.username, reason || null, "Marked as taken down — moved to Archive.");
      await logEvent(db, pk, "archived", user.username, null, null);
      break;
    }
    default:
      return { error: "Unknown action." };
  }

  revalidatePath("/", "layout");
  return { success: "Action applied." };
}
