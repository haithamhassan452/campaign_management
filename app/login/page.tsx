"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type ActionState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<ActionState, FormData>(loginAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">
            S
          </div>
          <h1 className="text-2xl font-bold">Campaign Management Portal</h1>
          <p className="mt-1 text-sm text-brand-100">Seoudi Supermarket · Internal use only</p>
        </div>

        <form action={formAction} className="card p-8">
          {state.error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}

          <label className="label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            className="input mb-4"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input mb-6"
            autoComplete="current-password"
            required
          />

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-xs text-brand-100/80">
          Accounts are created by Admins only. Contact your portal administrator for access.
        </p>
      </div>
    </main>
  );
}
