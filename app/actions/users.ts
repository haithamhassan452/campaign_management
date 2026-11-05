"use server";

// User management actions — PRD §02/§12 (Admin only, deactivation not deletion).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, nowIso } from "@/lib/db";
import { getSessionUser, hashPassword, passwordProblem } from "@/lib/auth";
import type { Role } from "@/lib/types";
import type { ActionState } from "./auth";

const ROLES: Role[] = ["admin", "growth_manager", "growth_supervisor", "content_team", "performance_member"];

async function guardAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/403?from=users");
  return user;
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guardAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const password = String(formData.get("password") ?? "");

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return { error: "Username must be 3-30 chars: lowercase letters, digits, . _ - only. It cannot be changed later." };
  }
  if (!displayName) return { error: "Display name is required." };
  if (!ROLES.includes(role)) return { error: "A role must be assigned — it cannot be left blank." };
  const problem = passwordProblem(password);
  if (problem) return { error: `Temporary password: ${problem}` };

  const db = await getDb();
  const existing = await db.selectFrom("users").select(["id"]).where("username", "=", username).executeTakeFirst();
  if (existing) return { error: "That username is already taken." };

  await db
    .insertInto("users")
    .values({
      username,
      password_hash: hashPassword(password),
      role,
      display_name: displayName,
      active: 1,
      must_change_password: 1,
      created_at: nowIso(),
    })
    .execute();

  revalidatePath("/users");
  return { success: `Account created for ${displayName}. They should change the temporary password after first login.` };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const id = Number(formData.get("id") ?? 0);
  const role = String(formData.get("role") ?? "") as Role;
  const displayName = String(formData.get("display_name") ?? "").trim();
  const active = formData.get("active") === "1";

  const db = await getDb();
  const target = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
  if (!target) return { error: "User not found." };
  if (!ROLES.includes(role)) return { error: "A role must be assigned." };
  if (!displayName) return { error: "Display name is required." };
  if (target.id === admin.id && !active) {
    return { error: "You cannot deactivate your own account." };
  }

  await db
    .updateTable("users")
    .set({ role, display_name: displayName, active: active ? 1 : 0 })
    .where("id", "=", id)
    .execute();

  revalidatePath("/users");
  return {
    success: active
      ? `Account ${target.username} updated.`
      : `Account ${target.username} deactivated — history is preserved.`,
  };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await guardAdmin();
  const id = Number(formData.get("id") ?? 0);
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const db = await getDb();
  const target = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
  if (!target) return { error: "User not found." };

  await db
    .updateTable("users")
    .set({ password_hash: hashPassword(password), must_change_password: 1 })
    .where("id", "=", id)
    .execute();

  revalidatePath("/users");
  return { success: `Password reset for ${target.username}. They will be asked to change it after login.` };
}
