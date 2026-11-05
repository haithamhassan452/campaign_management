"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { visibleNav } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export default function Nav({
  role,
  displayName,
  mustChangePassword,
}: {
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
}) {
  const pathname = usePathname();
  const items = visibleNav(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white">
          S
        </div>
        <div>
          <div className="text-sm font-bold leading-tight text-slate-900">Campaign Portal</div>
          <div className="text-[11px] text-slate-400">Seoudi Supermarket</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Sections
        </div>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-100 px-4 py-4">
        {mustChangePassword ? (
          <Link
            href="/profile"
            className="mb-3 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            ⚠︎ Set a new password
          </Link>
        ) : null}
        <div className="text-sm font-semibold text-slate-900">{displayName}</div>
        <div className="text-xs text-slate-400">{ROLE_LABELS[role]}</div>
        <div className="mt-2 flex gap-3 text-xs">
          <Link href="/profile" className="font-medium text-brand-600 hover:underline">
            Change password
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="font-medium text-slate-500 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
