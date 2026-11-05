// Shared domain types for the Campaign Management Portal.

export type Role =
  | "admin"
  | "growth_manager"
  | "growth_supervisor"
  | "content_team"
  | "performance_member";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  growth_manager: "Growth Manager",
  growth_supervisor: "Growth Supervisor",
  content_team: "Content Team",
  performance_member: "Performance Member",
};

export type Stage =
  | "in_pipeline"
  | "hub_pending"
  | "depots_pending"
  | "content_pending"
  | "live";

export const STAGE_LABELS: Record<Stage, string> = {
  in_pipeline: "In Pipeline",
  hub_pending: "Hub Pending",
  depots_pending: "Depots Pending",
  content_pending: "Content Pending",
  live: "Live",
};

export const STAGE_ORDER: Stage[] = [
  "in_pipeline",
  "hub_pending",
  "depots_pending",
  "content_pending",
  "live",
];

/** Lifecycle status of a campaign record (orthogonal to its board stage). */
export type CampaignStatus = "active" | "paused" | "rejected" | "archived";

export type ContentStatus = "awaiting" | "approved" | "rejected";

export type StockReadiness = "ready" | "attention" | "blocked" | "no_data";

export type Depot = "Hub" | "DS_Zayed" | "DS_Maadi" | "DS_Kitkat";

export const DEPOTS: Depot[] = ["DS_Zayed", "DS_Maadi", "DS_Kitkat"];

export const BANNER_TYPES = ["Main", "Secondary", "Strip", "Other"] as const;

export type NotificationStatus = "draft" | "pending_review" | "approved" | "rejected";

export type MessageType =
  | "Push notification"
  | "In-app message"
  | "WhatsApp"
  | "Abandoned cart"
  | "Recurring";

export const MESSAGE_TYPES: MessageType[] = [
  "Push notification",
  "In-app message",
  "WhatsApp",
  "Abandoned cart",
  "Recurring",
];

export const ACTIVITY_ACTION_TYPES = [
  "Banner repositioned",
  "Notification triggered",
  "SKU added",
  "Price adjusted",
  "Campaign paused",
  "Budget shifted",
  "Other",
] as const;

export type ActivityActionType = (typeof ACTIVITY_ACTION_TYPES)[number];

export type PlanningPeriod = "Yearly" | "Quarterly" | "Monthly";

export const PLANNING_PERIODS: PlanningPeriod[] = ["Yearly", "Quarterly", "Monthly"];

export type ImportType = "campaign_calendar" | "stock_values" | "performance_results";

export const IMPORT_TYPE_LABELS: Record<ImportType, string> = {
  campaign_calendar: "Campaign calendar",
  stock_values: "Stock values",
  performance_results: "Performance results",
};

// --- Notification copy length limits ---------------------------------------
// The PRD requires a live character count vs limit but does not define the
// limits. MVP assumption: 150 chars for push-style messages, 250 for in-app.
export const COPY_LIMITS: Record<MessageType, number> = {
  "Push notification": 150,
  "In-app message": 250,
  WhatsApp: 150,
  "Abandoned cart": 150,
  Recurring: 150,
};

// --- DB schema / row shapes -------------------------------------------------
import type { Generated, Selectable } from "kysely";

export interface UserTable {
  id: Generated<number>;
  username: string;
  password_hash: string;
  role: Role;
  display_name: string;
  active: number;
  must_change_password: number;
  created_at: string;
}

export interface CampaignTable {
  id: Generated<number>;
  campaign_id: string;
  title: string;
  launch_date: string;
  end_date: string;
  critical_skus: string; // JSON array of SKU codes
  normal_skus: string; // JSON array of SKU codes
  banner_asset_link: string | null;
  banner_type: string | null;
  banner_position: string | null;
  brief_owner: string;
  stage: Stage;
  content_status: ContentStatus;
  content_note: string | null;
  stock_readiness: StockReadiness;
  stock_updated_at: string | null;
  sent_back_reason: string | null;
  pause_reason: string | null;
  reject_reason: string | null;
  status: CampaignStatus;
  accepted_at: string | null;
  hub_confirmed_at: string | null;
  depots_confirmed_at: string | null;
  content_approved_at: string | null;
  published_at: string | null;
  paused_at: string | null;
  taken_down_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface CampaignEventTable {
  id: Generated<number>;
  campaign_pk: number;
  action: string;
  actor: string;
  reason: string | null;
  details: string | null;
  created_at: string;
}

export interface PlanningTable {
  id: Generated<number>;
  title: string;
  theme: string;
  period: PlanningPeriod;
  planned_launch_date: string;
  planned_end_date: string;
  revenue_target: number;
  owner: string;
  notes: string | null;
  imported_at: string;
}

export interface StockTable {
  id: Generated<number>;
  campaign_pk: number;
  sku_code: string;
  sku_type: "Hero" | "Regular";
  units_in_stock: number;
  units_required: number;
  depot: Depot;
  imported_at: string;
}

export interface NotificationTable {
  id: Generated<number>;
  message_type: MessageType;
  campaign_pk: number | null;
  ar_copy: string;
  en_copy: string;
  planned_send_at: string;
  target_segment: string | null;
  status: NotificationStatus;
  reviewer: string | null;
  review_note: string | null;
  created_by: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ActivityLogTable {
  id: Generated<number>;
  date: string;
  action_type: ActivityActionType;
  description: string;
  owner: string;
  impact: string | null;
  created_at: string;
}

export interface ActivityLogCampaignTable {
  id: Generated<number>;
  log_id: number;
  campaign_pk: number;
}

export interface PerformanceResultTable {
  id: Generated<number>;
  campaign_pk: number;
  actual_revenue: number;
  ctr: number | null;
  conversion_rate: number | null;
  oos_incidents: number;
  reporting_period: string; // YYYY-MM
  imported_at: string;
}

export interface ImportHistoryTable {
  id: Generated<number>;
  import_type: ImportType;
  created_at: string;
  admin_username: string;
  row_count: number;
  status: "success" | "error";
  error_report: string | null;
}

// Resolved row shapes (what queries return).
export type UserRow = Selectable<UserTable>;
export type CampaignRow = Selectable<CampaignTable>;
export type CampaignEventRow = Selectable<CampaignEventTable>;
export type PlanningRow = Selectable<PlanningTable>;
export type StockRow = Selectable<StockTable>;
export type NotificationRow = Selectable<NotificationTable>;
export type ActivityLogRow = Selectable<ActivityLogTable>;
export type ActivityLogCampaignRow = Selectable<ActivityLogCampaignTable>;
export type PerformanceResultRow = Selectable<PerformanceResultTable>;
export type ImportHistoryRow = Selectable<ImportHistoryTable>;
