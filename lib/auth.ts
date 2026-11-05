// Password hashing, session cookies and role checks.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, nowIso } from "./db";
import type { Role, UserRow } from "./types";
import { can } from "./permissions";
import type { Capability } from "./permissions";

export {
  hashPassword,
  verifyPassword,
  passwordProblem,
  PASSWORD_MIN_LENGTH,
} from "./password";

const SESSION_COOKIE = "cmp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function secret(): string {
  return process.env.SESSION_SECRET || "dev-only-insecure-session-secret";
}

// --- session ----------------------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(user: UserRow): Promise<void> {
  const body = Buffer.from(
    JSON.stringify({ uid: user.id, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let parsed: { uid: number; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!parsed?.uid || parsed.exp < Date.now()) return null;
  const db = await getDb();
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", parsed.uid)
    .where("active", "=", 1)
    .executeTakeFirst();
  return user ?? null;
}

/** Require an authenticated user; redirect to /login otherwise. */
export async function requireUser(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require the current user to hold one of `roles` (or to pass `capability`
 * check). Renders the 403 page flow by redirecting to /403?from=...
 */
export async function requireCapability(
  capability: Capability,
  from: string,
): Promise<UserRow> {
  const user = await requireUser();
  if (!can(user.role, capability)) {
    redirect(`/403?from=${encodeURIComponent(from)}`);
  }
  return user;
}

export async function requireRoles(roles: Role[], from: string): Promise<UserRow> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(`/403?from=${encodeURIComponent(from)}`);
  }
  return user;
}

export function logEvent(
  db: Awaited<ReturnType<typeof getDb>>,
  campaignPk: number,
  action: string,
  actor: string,
  reason: string | null,
  details: string | null,
) {
  return db
    .insertInto("campaign_events")
    .values({
      campaign_pk: campaignPk,
      action,
      actor,
      reason,
      details,
      created_at: nowIso(),
    })
    .execute();
}
