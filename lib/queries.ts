// Server-side read models for the portal pages.

import { getDb } from "./db";
import type { AppDatabase } from "./db";
import type { CampaignRow, StockRow, Stage, Depot } from "./types";
import { DEPOTS } from "./types";
import { campaignView, computeSla, summarizeStock, type SlaInfo, type StockSummary, type CampaignView } from "./campaigns";

export interface CampaignCard {
  id: number;
  campaignId: string;
  title: string;
  launchDate: string;
  endDate: string;
  stage: Stage;
  status: CampaignRow["status"];
  bannerType: string | null;
  bannerPosition: string | null;
  contentStatus: CampaignRow["content_status"];
  stockReadiness: StockSummary["readiness"];
  hubConfirmed: boolean;
  hubHasRows: boolean;
  depotStatus: Record<string, { confirmed: boolean; hasRows: boolean }>;
  sla: SlaInfo;
  view: CampaignView;
  sentBack: boolean;
  paused: boolean;
  criticalCount: number;
  skuText: string;
  briefOwner: string;
  publishedAt: string | null;
}

function toCard(campaign: CampaignRow, rows: StockRow[]): CampaignCard {
  const stock = summarizeStock(rows);
  const depotStatus: CampaignCard["depotStatus"] = {};
  for (const d of [...DEPOTS, "Hub" as Depot]) {
    const b = stock.byDepot[d];
    depotStatus[d] = { confirmed: Boolean(b?.hasRows && b.ready), hasRows: Boolean(b?.hasRows) };
  }
  return {
    id: campaign.id,
    campaignId: campaign.campaign_id,
    title: campaign.title,
    launchDate: campaign.launch_date,
    endDate: campaign.end_date,
    stage: campaign.stage,
    status: campaign.status,
    bannerType: campaign.banner_type,
    bannerPosition: campaign.banner_position,
    contentStatus: campaign.content_status,
    stockReadiness: stock.readiness,
    hubConfirmed: stock.hubConfirmed,
    hubHasRows: depotStatus["Hub"].hasRows,
    depotStatus,
    sla: computeSla(campaign),
    view: campaignView(campaign),
    sentBack: Boolean(campaign.sent_back_reason),
    paused: campaign.status === "paused",
    criticalCount: JSON.parse(campaign.critical_skus || "[]").length,
    skuText: `${campaign.critical_skus || ""} ${campaign.normal_skus || ""}`,
    briefOwner: campaign.brief_owner,
    publishedAt: campaign.published_at,
  };
}

export async function loadAllCampaignCards(db?: AppDatabase): Promise<CampaignCard[]> {
  const database = db ?? (await getDb());
  const campaigns = await database.selectFrom("campaigns").selectAll().orderBy("id", "desc").execute();
  const allStock = await database.selectFrom("stock_rows").selectAll().execute();
  const byCampaign = new Map<number, StockRow[]>();
  for (const row of allStock) {
    const list = byCampaign.get(row.campaign_pk) ?? [];
    list.push(row);
    byCampaign.set(row.campaign_pk, list);
  }
  return campaigns.map((c) => toCard(c, byCampaign.get(c.id) ?? []));
}

export async function loadCampaignCard(id: number): Promise<CampaignCard | null> {
  const db = await getDb();
  const campaign = await db.selectFrom("campaigns").selectAll().where("id", "=", id).executeTakeFirst();
  if (!campaign) return null;
  const rows = await db.selectFrom("stock_rows").selectAll().where("campaign_pk", "=", id).execute();
  return toCard(campaign, rows);
}

export interface CampaignDetail extends CampaignCard {
  campaign: CampaignRow;
  criticalSkus: string[];
  normalSkus: string[];
  stockRows: StockRow[];
  stock: StockSummary;
  events: {
    id: number;
    action: string;
    actor: string;
    reason: string | null;
    details: string | null;
    created_at: string;
  }[];
  notifications: {
    id: number;
    message_type: string;
    status: string;
    en_copy: string;
    planned_send_at: string;
    reviewer: string | null;
  }[];
  planning: {
    id: number;
    title: string;
    theme: string;
    revenue_target: number;
    period: string;
  } | null;
  performance: {
    actual_revenue: number;
    ctr: number | null;
    conversion_rate: number | null;
    oos_incidents: number;
    reporting_period: string;
    imported_at: string;
  } | null;
}

export async function loadCampaignDetail(id: number): Promise<CampaignDetail | null> {
  const db = await getDb();
  const campaign = await db.selectFrom("campaigns").selectAll().where("id", "=", id).executeTakeFirst();
  if (!campaign) return null;
  const stockRows = await db
    .selectFrom("stock_rows")
    .selectAll()
    .where("campaign_pk", "=", id)
    .orderBy("depot")
    .orderBy("sku_code")
    .execute();
  const events = await db
    .selectFrom("campaign_events")
    .select(["id", "action", "actor", "reason", "details", "created_at"])
    .where("campaign_pk", "=", id)
    .orderBy("created_at", "desc")
    .execute();
  const notifications = await db
    .selectFrom("notifications")
    .select(["id", "message_type", "status", "en_copy", "planned_send_at", "reviewer"])
    .where("campaign_pk", "=", id)
    .orderBy("planned_send_at")
    .execute();
  // PRD gap resolution: planning entries link to campaigns by unique title.
  const planning = await db
    .selectFrom("planning_entries")
    .select(["id", "title", "theme", "revenue_target", "period"])
    .where("title", "=", campaign.title)
    .executeTakeFirst();
  const performance = await db
    .selectFrom("performance_results")
    .select(["actual_revenue", "ctr", "conversion_rate", "oos_incidents", "reporting_period", "imported_at"])
    .where("campaign_pk", "=", id)
    .orderBy("reporting_period", "desc")
    .executeTakeFirst();

  return {
    ...toCard(campaign, stockRows),
    campaign,
    criticalSkus: JSON.parse(campaign.critical_skus || "[]"),
    normalSkus: JSON.parse(campaign.normal_skus || "[]"),
    stockRows,
    stock: summarizeStock(stockRows),
    events,
    notifications,
    planning: planning ?? null,
    performance: performance ?? null,
  };
}
