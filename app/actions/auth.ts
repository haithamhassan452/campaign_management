"use server";

// Auth server actions: login, logout, change password.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "@/lib/auth";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "Username or password is incorrect" };
  }
  const db = await getDb();
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("username", "=", username.toLowerCase())
    .executeTakeFirst();
  if (!user || user.active !== 1 || !verifyPassword(password, user.password_hash)) {
    return { error: "Username or password is incorrect" };
  }
  await createSession(user);
  redirect("/board");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!verifyPassword(current, user.password_hash)) {
    return { error: "Current password is incorrect." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "New passwords do not match." };

  const db = await getDb();
  await db
    .updateTable("users")
    .set({ password_hash: hashPassword(next), must_change_password: 0 })
    .where("id", "=", user.id)
    .execute();
  revalidatePath("/", "layout");
  return { success: "Password updated successfully." };
}
