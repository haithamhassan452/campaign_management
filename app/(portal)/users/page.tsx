// User management — PRD §02/§12. Admin only. Deactivation, never deletion.

import { requireCapability } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import UserForms from "@/components/users/UserForms";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireCapability("users", "User management");
  const db = await getDb();
  const users = await db.selectFrom("users").selectAll().orderBy("username").execute();

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle="Accounts are created by Admins with a username, temporary password and assigned role. Accounts can be deactivated — never deleted — so history stays intact."
      />

      <div className="grid grid-cols-3 gap-6">
        <UserForms
          users={users.map((u) => ({
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            role: u.role,
            role_label: ROLE_LABELS[u.role],
            active: u.active === 1,
            must_change_password: u.must_change_password === 1,
            created_at: u.created_at.slice(0, 10),
          }))}
          currentUserId={admin.id}
          roleOptions={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <div className="col-span-2">
          <div className="overflow-x-auto card">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Username</th>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="td font-medium text-slate-900">{u.username}</td>
                    <td className="td">
                      {u.display_name}
                      {u.must_change_password === 1 ? (
                        <Badge tone="amber" title="Temporary password — user should change it">
                          {" "}
                          temp password
                        </Badge>
                      ) : null}
                    </td>
                    <td className="td">{ROLE_LABELS[u.role]}</td>
                    <td className="td">
                      {u.active === 1 ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Deactivated</Badge>}
                    </td>
                    <td className="td">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Deactivated accounts cannot log in, but their history, activity log entries and approvals
            remain intact and keep their original user names.
          </p>
        </div>
      </div>
    </div>
  );
}
