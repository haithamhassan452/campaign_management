"use server";

// Activity log actions — PRD §09.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ActivityActionType } from "@/lib/types";
import type { ActionState } from "./auth";

export async function createActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "activity_manage")) redirect("/403?from=activity-log");

  const date = String(formData.get("date") ?? "").trim();
  const actionType = String(formData.get("action_type") ?? "") as ActivityActionType;
  const description = String(formData.get("description") ?? "").trim();
  const impact = String(formData.get("impact") ?? "").trim();
  const campaignPks = formData
    .getAll("campaign_pks")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!date) return { error: "Date is required." };
  if (!actionType) return { error: "Action type is required." };
  if (campaignPks.length === 0) return { error: "At least one campaign association is required." };
  if (!description) return { error: "Description is required." };

  const db = await getDb();
  const res = await db
    .insertInto("activity_logs")
    .values({
      date,
      action_type: actionType,
      description,
      owner: user.username, // auto-filled and locked
      impact: impact || null,
      created_at: nowIso(),
    })
    .executeTakeFirst();
  const logId = Number(res.insertId ?? 0);
  for (const pk of campaignPks) {
    await db
      .insertInto("activity_log_campaigns")
      .values({ log_id: logId, campaign_pk: pk })
      .execute();
  }

  revalidatePath("/activity-log");
  return { success: "Optimization action logged." };
}
