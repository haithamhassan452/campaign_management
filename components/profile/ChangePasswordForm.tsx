"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changePasswordAction, type ActionState } from "@/app/actions/auth";
import { FormMessage } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

export default function ChangePasswordForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(changePasswordAction, {});

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <h2 className="text-sm font-bold text-slate-900">Change password</h2>
      <FormMessage state={state} />

      <div>
        <label className="label">Current password</label>
        <input type="password" name="current" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label">New password</label>
        <input type="password" name="next" className="input" autoComplete="new-password" required />
        <p className="mt-1 text-xs text-slate-400">
          Min 8 characters with at least one letter and one number.
        </p>
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input type="password" name="confirm" className="input" autoComplete="new-password" required />
      </div>
      <Submit />
    </form>
  );
}
