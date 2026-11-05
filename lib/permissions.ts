// Role → capability matrix, derived from PRD §03 (User Roles & Permissions).
//
// PRD gaps resolved here (documented in docs/PRD-GAPS.md):
//  - Activity log: PRD table says Growth Manager "Full" but the §09 narrative
//    says only Performance Member and Admin can create entries. Resolution:
//    manage = Admin + Performance Member; everyone else views (GM gets all
//    filters/rollups = "full view").
//  - Growth Supervisor "Limited" new-brief access: resolved as the ability to
//    submit briefs, plus Approve/Reject campaign actions only.

import type { Role } from "./types";

export type Capability =
  | "board_view"
  | "board_full" // view + detail panel with SLA detail
  | "brief_create"
  | "actions_all" // publish / reject / hold / pause / accept / send back
  | "actions_approve_reject" // accept brief + reject only
  | "actions_content" // content approve + mark taken down
  | "notifications_view"
  | "notifications_manage" // create / edit / submit / approve
  | "activity_view"
  | "activity_manage" // create + edit entries
  | "performance_view"
  | "imports"
  | "users";

const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "board_view",
    "board_full",
    "brief_create",
    "actions_all",
    "notifications_view",
    "notifications_manage",
    "activity_view",
    "activity_manage",
    "performance_view",
    "imports",
    "users",
  ],
  growth_manager: [
    "board_view",
    "board_full",
    "brief_create",
    "actions_all",
    "notifications_view",
    "activity_view",
    "performance_view",
  ],
  growth_supervisor: [
    "board_view",
    "board_full",
    "brief_create",
    "actions_approve_reject",
    "notifications_view",
    "activity_view",
    "performance_view",
  ],
  content_team: [
    "board_view",
    "actions_content",
    "notifications_view",
    "notifications_manage",
    "activity_view",
  ],
  performance_member: [
    "board_view",
    "notifications_view",
    "activity_view",
    "activity_manage",
    "performance_view",
  ],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role]?.includes(capability) ?? false;
}

export interface NavItem {
  href: string;
  label: string;
  capability: Capability;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/board", label: "Board", capability: "board_view" },
  { href: "/planning", label: "Planning", capability: "board_view" },
  { href: "/stock", label: "Stock readiness", capability: "board_view" },
  { href: "/notifications", label: "Notifications", capability: "notifications_view" },
  { href: "/activity-log", label: "Activity log", capability: "activity_view" },
  { href: "/performance", label: "Performance", capability: "performance_view" },
  { href: "/sla", label: "SLA dashboard", capability: "board_full" },
  { href: "/archive", label: "Campaign history", capability: "board_view" },
  { href: "/imports", label: "Sheet imports", capability: "imports" },
  { href: "/users", label: "User management", capability: "users" },
];

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.capability));
}
