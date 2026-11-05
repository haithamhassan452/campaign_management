import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl">
      <PageHeader title="My account" subtitle="Your profile and password settings." />

      <div className="card mb-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">{user.display_name}</div>
            <div className="text-sm text-slate-400">@{user.username}</div>
          </div>
          <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
        </div>
        {user.must_change_password === 1 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            You are using a temporary password — please set a new one below.
          </div>
        ) : null}
      </div>

      <ChangePasswordForm />
    </div>
  );
}
