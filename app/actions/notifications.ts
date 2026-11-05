"use server";

// Notification actions — PRD §08 (campaign-linked + global planner).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { MessageType, NotificationStatus } from "@/lib/types";
import type { ActionState } from "./auth";

async function guardNotifications(manage: boolean) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ok = manage ? can(user.role, "notifications_manage") : can(user.role, "notifications_view");
  if (!ok) redirect("/403?from=notifications");
  return user;
}

export async function createNotificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await guardNotifications(true);
  const messageType = String(formData.get("message_type") ?? "") as MessageType;
  const campaignPkRaw = String(formData.get("campaign_pk") ?? "");
  const isGlobal = formData.get("is_global") === "on";
  const arCopy = String(formData.get("ar_copy") ?? "").trim();
  const enCopy = String(formData.get("en_copy") ?? "").trim();
  const plannedSend = String(formData.get("planned_send_at") ?? "");
  const segment = String(formData.get("target_segment") ?? "").trim();

  if (!messageType) return { error: "Message type is required." };
  if (!arCopy) return { error: "Arabic copy cannot be blank." };
  if (!enCopy) return { error: "English copy cannot be blank." };
  if (!plannedSend) return { error: "Planned send date/time is required." };

  const campaignPk = isGlobal ? null : Number(campaignPkRaw);
  if (!isGlobal && !campaignPk) {
    return { error: "Campaign association is required for campaign-linked notifications." };
  }

  const db = await getDb();
  if (campaignPk) {
    const campaign = await db.selectFrom("campaigns").select(["id", "stage"]).where("id", "=", campaignPk).executeTakeFirst();
    if (!campaign) return { error: "Selected campaign does not exist." };
    // PRD: planned send date must be before campaign go-live for campaign-linked.
    const c = await db.selectFrom("campaigns").select(["published_at"]).where("id", "=", campaignPk).executeTakeFirst();
    if (c?.published_at && plannedSend > c.published_at) {
      return { error: "Planned send date must be before the campaign goes live." };
    }
  }

  await db
    .insertInto("notifications")
    .values({
      message_type: messageType,
      campaign_pk: campaignPk,
      ar_copy: arCopy,
      en_copy: enCopy,
      planned_send_at: plannedSend,
      target_segment: segment || null,
      status: "draft",
      reviewer: null,
      review_note: null,
      created_by: user.username,
      submitted_at: null,
      reviewed_at: null,
      created_at: nowIso(),
    })
    .execute();

  revalidatePath("/notifications");
  return { success: "Notification saved as Draft." };
}

export async function notificationStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await guardNotifications(true);
  const id = Number(formData.get("id") ?? 0);
  const next = String(formData.get("next") ?? "") as NotificationStatus;
  const note = String(formData.get("note") ?? "").trim();

  const db = await getDb();
  const record = await db.selectFrom("notifications").selectAll().where("id", "=", id).executeTakeFirst();
  if (!record) return { error: "Notification not found." };

  const now = nowIso();
  if (next === "pending_review") {
    if (record.created_by !== user.username && user.role !== "admin") {
      return { error: "Only the creator or an Admin can submit a notification for review." };
    }
    await db
      .updateTable("notifications")
      .set({ status: "pending_review", submitted_at: now })
      .where("id", "=", id)
      .execute();
    return { success: "Submitted for review." };
  }

  if (next === "approved" || next === "rejected") {
    // Approver: Content Team (lead) or Admin — per PRD §08 user story.
    if (user.role !== "admin" && user.role !== "content_team") {
      return { error: "Only Content Team or Admin can review notifications." };
    }
    if (record.status !== "pending_review") {
      return { error: "Only notifications pending review can be approved or rejected." };
    }
    if (next === "rejected" && !note) {
      return { error: "A review note is required when rejecting." };
    }
    await db
      .updateTable("notifications")
      .set({
        status: next,
        reviewer: user.username,
        review_note: note || null,
        reviewed_at: now,
      })
      .where("id", "=", id)
      .execute();
    return { success: next === "approved" ? "Notification approved." : "Notification rejected." };
  }

  return { error: "Unknown status transition." };
}

export async function editNotificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await guardNotifications(true);
  const id = Number(formData.get("id") ?? 0);
  const arCopy = String(formData.get("ar_copy") ?? "").trim();
  const enCopy = String(formData.get("en_copy") ?? "").trim();
  const plannedSend = String(formData.get("planned_send_at") ?? "");
  const segment = String(formData.get("target_segment") ?? "").trim();

  const db = await getDb();
  const record = await db.selectFrom("notifications").selectAll().where("id", "=", id).executeTakeFirst();
  if (!record) return { error: "Notification not found." };
  if (record.status !== "draft" && record.status !== "rejected" && user.role !== "admin") {
    return { error: "Only Draft or Rejected notifications can be edited." };
  }
  if (!arCopy || !enCopy) return { error: "Arabic and English copy cannot be blank." };
  if (!plannedSend) return { error: "Planned send date/time is required." };

  await db
    .updateTable("notifications")
    .set({
      ar_copy: arCopy,
      en_copy: enCopy,
      planned_send_at: plannedSend,
      target_segment: segment || null,
      status: record.status === "rejected" ? "draft" : record.status,
      review_note: record.status === "rejected" ? null : record.review_note,
    })
    .where("id", "=", id)
    .execute();

  revalidatePath("/notifications");
  return { success: "Notification updated." };
}
