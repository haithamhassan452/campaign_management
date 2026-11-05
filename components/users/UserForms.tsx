"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
} from "@/app/actions/users";
import type { ActionState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui";

interface UserLite {
  id: number;
  username: string;
  display_name: string;
  role: string;
  role_label: string;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export default function UserForms({
  users,
  currentUserId,
  roleOptions,
}: {
  users: UserLite[];
  currentUserId: number;
  roleOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"create" | "edit" | "reset">("create");
  const [selectedId, setSelectedId] = useState<number | "">("");

  const selected = users.find((u) => u.id === selectedId) ?? null;

  const run = (action: typeof createUserAction) => (formData: FormData) => {
    startTransition(async () => {
      const result = await action(state ?? {}, formData);
      setState(result);
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex gap-2">
          {(["create", "edit", "reset"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => setMode(m)}
            >
              {m === "create" ? "Create account" : m === "edit" ? "Edit / deactivate" : "Reset password"}
            </button>
          ))}
        </div>

        <FormMessage state={state} />

        {mode === "create" ? (
          <form action={run(createUserAction)} className="space-y-4">
            <div>
              <label className="label">Username *</label>
              <input name="username" className="input" placeholder="lowercase, 3–30 chars" required />
              <p className="mt-1 text-xs text-slate-400">Unique and permanent — cannot be changed later.</p>
            </div>
            <div>
              <label className="label">Display name *</label>
              <input name="display_name" className="input" required />
            </div>
            <div>
              <label className="label">Role *</label>
              <select name="role" className="input" defaultValue="" required>
                <option value="" disabled>
                  Assign a role…
                </option>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Temporary password *</label>
              <input name="password" type="text" className="input" required />
              <p className="mt-1 text-xs text-slate-400">
                Min 8 chars with a letter and a number. The user is asked to change it after first login.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </button>
          </form>
        ) : null}

        {mode === "edit" ? (
          <form action={run(updateUserAction)} className="space-y-4">
            <div>
              <label className="label">Account</label>
              <select
                className="input"
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                required
              >
                <option value="">Select account…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} — {u.display_name}
                  </option>
                ))}
              </select>
            </div>
            {selected ? (
              <>
                <input type="hidden" name="id" value={selected.id} />
                <div>
                  <label className="label">Display name *</label>
                  <input name="display_name" className="input" defaultValue={selected.display_name} required />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select name="role" className="input" defaultValue={selected.role}>
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select name="active" className="input" defaultValue={selected.active ? "1" : "0"}>
                    <option value="1">Active</option>
                    <option value="0">Deactivated (history preserved)</option>
                  </select>
                </div>
                {selected.id === currentUserId ? (
                  <p className="text-xs text-amber-600">You cannot deactivate your own account.</p>
                ) : null}
                <button type="submit" className="btn-primary w-full" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">Choose an account to edit.</p>
            )}
          </form>
        ) : null}

        {mode === "reset" ? (
          <form action={run(resetPasswordAction)} className="space-y-4">
            <div>
              <label className="label">Account</label>
              <select name="id" className="input" required defaultValue="">
                <option value="" disabled>
                  Select account…
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} — {u.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">New temporary password *</label>
              <input name="password" type="text" className="input" required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
