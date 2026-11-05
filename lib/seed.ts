// Demo seed data — applied automatically when the database is empty.
// Dates are computed relative to "today" so the demo (e.g. the Publish button
// unlocking exactly on a launch date) stays live whenever it runs.

import type { AppDatabase } from "./db";
import type { UserTable } from "./types";
import { nowIso } from "./db";
import { hashPassword } from "./password";
import { addDays, parseDate, toIsoDay, today } from "./format";

function dayOffset(n: number): string {
  return toIsoDay(addDays(today(), n));
}

function isoOffset(n: number, hour = 10): string {
  const d = addDays(today(), n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function monthOffset(n: number): string {
  const d = today();
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function seedIfEmpty(db: AppDatabase): Promise<void> {
  const existing = await db.selectFrom("users").select(({ fn }) => [fn.countAll().as("c")]).executeTakeFirst();
  if (existing && Number(existing.c) > 0) return;

  const now = nowIso();

  // --- users ---------------------------------------------------------------
  const users: { username: string; display_name: string; role: string; pw: string; inactive?: boolean }[] = [
    { username: "admin", display_name: "Mariam Adel", role: "admin", pw: "Admin123!" },
    { username: "growth", display_name: "Nour Ahmed", role: "growth_manager", pw: "Growth123!" },
    { username: "supervisor", display_name: "Karim Fathy", role: "growth_supervisor", pw: "Supervisor123!" },
    { username: "content", display_name: "Salma Tarek", role: "content_team", pw: "Content123!" },
    { username: "performance", display_name: "Yara Mostafa", role: "performance_member", pw: "Performance123!" },
    { username: "hossam", display_name: "Hossam Ehab", role: "growth_manager", pw: "Hossam123!", inactive: true },
  ];

  const userId: Record<string, number> = {};
  for (const u of users) {
    const res = await db
      .insertInto("users")
      .values({
        username: u.username,
        password_hash: hashPassword(u.pw),
        role: u.role as UserTable["role"],
        display_name: u.display_name,
        active: u.inactive ? 0 : 1,
        must_change_password: 0,
        created_at: isoOffset(-90),
      })
      .executeTakeFirst();
    userId[u.username] = Number(res.insertId ?? 0);
  }

  // --- planning entries ----------------------------------------------------
  const planning = [
    ["Ramadan Prep — Early Bird", "Ramadan", "Quarterly", dayOffset(0), dayOffset(21), 2500000, "Nour Ahmed", "Teaser phase before full Ramadan push."],
    ["Weekend Fresh Deals", "Fresh Food", "Monthly", dayOffset(-3), dayOffset(4), 900000, "Nour Ahmed", "Recurring weekend fresh produce push."],
    ["P&G Mega Bundle", "P&G brand push", "Monthly", dayOffset(-2), dayOffset(5), 1400000, "Karim Fathy", "Co-funded P&G bundle mechanics."],
    ["Back to School Restock", "Back to School", "Monthly", dayOffset(3), dayOffset(17), 1100000, "Karim Fathy", null],
    ["Fresh Veggie Week", "Fresh Food", "Monthly", dayOffset(2), dayOffset(9), 650000, "Nour Ahmed", null],
    ["Snack Bundle Bonanza", "Snacks", "Monthly", dayOffset(8), dayOffset(15), 780000, "Nour Ahmed", null],
    ["Dairy Festival", "Dairy", "Monthly", dayOffset(2), dayOffset(12), 920000, "Karim Fathy", null],
    ["Home Care Festival", "Home Care", "Quarterly", dayOffset(12), dayOffset(26), 1050000, "Karim Fathy", null],
    ["Eid Sweets Preview", "Eid", "Quarterly", dayOffset(20), dayOffset(34), 1750000, "Nour Ahmed", "Early planning for Eid."],
    ["Autumn Beverages", "Beverages", "Monthly", dayOffset(-30), dayOffset(-2), 830000, "Nour Ahmed", null],
    ["Summer Splash", "Seasonal", "Quarterly", dayOffset(-75), dayOffset(-40), 1250000, "Karim Fathy", null],
    ["Baby Care Week", "Baby Care", "Monthly", dayOffset(20), dayOffset(27), 540000, "Nour Ahmed", null],
    ["Healthy Living Month", "Wellness", "Monthly", dayOffset(25), dayOffset(55), 700000, "Karim Fathy", "No brief submitted yet."],
    ["National Day Promo", "National Day", "Yearly", dayOffset(40), dayOffset(47), 1600000, "Nour Ahmed", "No brief submitted yet."],
  ];
  const planningIds: number[] = [];
  for (const p of planning) {
    const res = await db
      .insertInto("planning_entries")
      .values({
        title: p[0] as string,
        theme: p[1] as string,
        period: p[2] as never,
        planned_launch_date: p[3] as string,
        planned_end_date: p[4] as string,
        revenue_target: p[5] as number,
        owner: p[6] as string,
        notes: p[7] as string | null,
        imported_at: isoOffset(-45),
      })
      .executeTakeFirst();
    planningIds.push(Number(res.insertId ?? 0));
  }

  // --- campaigns -----------------------------------------------------------
  type SeedCampaign = {
    id: string;
    title: string;
    launch: string;
    end: string;
    critical: string[];
    normal: string[];
    banner: string;
    stage: string;
    content: string;
    readiness: string;
    owner: string;
    status?: string;
    createdOffset: number;
    extra?: Record<string, unknown>;
  };

  const campaigns: SeedCampaign[] = [
    {
      id: "CMP-1001", title: "Weekend Fresh Deals", launch: dayOffset(-3), end: dayOffset(4),
      critical: ["SKU-1001", "SKU-1002", "SKU-1003"], normal: ["SKU-2001", "SKU-2002"],
      banner: "Main", stage: "live", content: "approved", readiness: "ready", owner: "growth",
      createdOffset: -20, extra: { published_at: isoOffset(-3, 8), content_approved_at: isoOffset(-6), accepted_at: isoOffset(-18), hub_confirmed_at: isoOffset(-14), depots_confirmed_at: isoOffset(-10), stock_updated_at: isoOffset(-10), banner_position: "Homepage Slider 1", banner_asset_link: "https://drive.google.com/example/weekend-fresh" },
    },
    {
      id: "CMP-1002", title: "P&G Mega Bundle", launch: dayOffset(-2), end: dayOffset(5),
      critical: ["SKU-1101", "SKU-1102"], normal: ["SKU-2101"],
      banner: "Secondary", stage: "live", content: "approved", readiness: "ready", owner: "growth",
      status: "paused", createdOffset: -22,
      extra: { published_at: isoOffset(-2, 9), paused_at: isoOffset(-1, 14), pause_reason: "Bundle pricing error raised by P&G team — fixing mechanics before resume.", content_approved_at: isoOffset(-7), accepted_at: isoOffset(-20), hub_confirmed_at: isoOffset(-16), depots_confirmed_at: isoOffset(-12), stock_updated_at: isoOffset(-12), banner_position: "Category Top" },
    },
    {
      id: "CMP-1003", title: "Ramadan Prep — Early Bird", launch: dayOffset(0), end: dayOffset(21),
      critical: ["SKU-1201", "SKU-1202", "SKU-1203", "SKU-1204"], normal: ["SKU-2201"],
      banner: "Main", stage: "content_pending", content: "approved", readiness: "attention", owner: "growth",
      createdOffset: -12,
      extra: { content_approved_at: isoOffset(-2), accepted_at: isoOffset(-11), hub_confirmed_at: isoOffset(-8), depots_confirmed_at: isoOffset(-4), stock_updated_at: isoOffset(-1), banner_position: "Homepage Slider 2", banner_asset_link: "https://drive.google.com/example/ramadan-early" },
    },
    {
      id: "CMP-1004", title: "Back to School Restock", launch: dayOffset(3), end: dayOffset(17),
      critical: ["SKU-1301", "SKU-1302"], normal: ["SKU-2301", "SKU-2302", "SKU-2303"],
      banner: "Strip", stage: "content_pending", content: "awaiting", readiness: "ready", owner: "supervisor",
      createdOffset: -9,
      extra: { accepted_at: isoOffset(-8), hub_confirmed_at: isoOffset(-6), depots_confirmed_at: isoOffset(-3), stock_updated_at: isoOffset(-3), banner_position: "Homepage Strip" },
    },
    {
      id: "CMP-1005", title: "Fresh Veggie Week", launch: dayOffset(2), end: dayOffset(9),
      critical: ["SKU-1401", "SKU-1402"], normal: ["SKU-2401"],
      banner: "Secondary", stage: "depots_pending", content: "awaiting", readiness: "blocked", owner: "growth",
      createdOffset: -7,
      extra: { accepted_at: isoOffset(-6), hub_confirmed_at: isoOffset(-5), stock_updated_at: isoOffset(-1), banner_position: "Category Top" },
    },
    {
      id: "CMP-1006", title: "Snack Bundle Bonanza", launch: dayOffset(8), end: dayOffset(15),
      critical: ["SKU-1501", "SKU-1502"], normal: [],
      banner: "Main", stage: "depots_pending", content: "awaiting", readiness: "ready", owner: "supervisor",
      createdOffset: -5,
      extra: { accepted_at: isoOffset(-4), hub_confirmed_at: isoOffset(-2), stock_updated_at: isoOffset(0, 9), banner_position: "Homepage Slider 3" },
    },
    {
      id: "CMP-1007", title: "Dairy Festival", launch: dayOffset(2), end: dayOffset(12),
      critical: ["SKU-1601", "SKU-1602", "SKU-1603"], normal: ["SKU-2601"],
      banner: "Secondary", stage: "hub_pending", content: "awaiting", readiness: "no_data", owner: "growth",
      createdOffset: -6,
      extra: { accepted_at: isoOffset(-5), banner_position: "Category Top" },
    },
    {
      id: "CMP-1008", title: "Home Care Festival", launch: dayOffset(12), end: dayOffset(26),
      critical: ["SKU-1701"], normal: ["SKU-2701", "SKU-2702"],
      banner: "Strip", stage: "hub_pending", content: "awaiting", readiness: "no_data", owner: "supervisor",
      createdOffset: -3,
      extra: { accepted_at: isoOffset(-2), banner_position: "Homepage Strip" },
    },
    {
      id: "CMP-1009", title: "Eid Sweets Preview", launch: dayOffset(20), end: dayOffset(34),
      critical: ["SKU-1801", "SKU-1802"], normal: [],
      banner: "Main", stage: "in_pipeline", content: "awaiting", readiness: "no_data", owner: "growth",
      createdOffset: -1, extra: { banner_position: "Homepage Slider 1" },
    },
    {
      id: "CMP-1010", title: "Baby Care Week", launch: dayOffset(20), end: dayOffset(27),
      critical: ["SKU-1901"], normal: ["SKU-2901"],
      banner: "Secondary", stage: "in_pipeline", content: "awaiting", readiness: "no_data", owner: "growth",
      createdOffset: -2,
      extra: { sent_back_reason: "Critical SKU-1901 unavailable at Hub — sent back to Marketing to swap SKU or move dates." },
    },
    {
      id: "CMP-1011", title: "Autumn Beverages", launch: dayOffset(-30), end: dayOffset(-2),
      critical: ["SKU-1111", "SKU-1112"], normal: ["SKU-2111"],
      banner: "Main", stage: "live", content: "approved", readiness: "ready", owner: "growth",
      createdOffset: -60,
      extra: { published_at: isoOffset(-30, 8), content_approved_at: isoOffset(-33), accepted_at: isoOffset(-55), hub_confirmed_at: isoOffset(-50), depots_confirmed_at: isoOffset(-45), stock_updated_at: isoOffset(-45), banner_position: "Homepage Slider 1" },
    },
    {
      id: "CMP-1012", title: "Summer Splash", launch: dayOffset(-75), end: dayOffset(-40),
      critical: ["SKU-1121"], normal: [],
      banner: "Strip", stage: "live", content: "approved", readiness: "ready", owner: "supervisor",
      status: "archived", createdOffset: -110,
      extra: { published_at: isoOffset(-75, 8), taken_down_at: isoOffset(-39), archived_at: isoOffset(-38), content_approved_at: isoOffset(-78), accepted_at: isoOffset(-100), hub_confirmed_at: isoOffset(-95), depots_confirmed_at: isoOffset(-90), stock_updated_at: isoOffset(-90), banner_position: "Homepage Strip" },
    },
    {
      id: "CMP-1013", title: "Frozen Foods Flash", launch: dayOffset(6), end: dayOffset(13),
      critical: ["SKU-1131"], normal: [],
      banner: "Other", stage: "in_pipeline", content: "awaiting", readiness: "no_data", owner: "growth",
      status: "rejected", createdOffset: -8,
      extra: { reject_reason: "Margin too low after supplier review — revisit next quarter.", banner_position: "Other" },
    },
  ];

  const campaignPk: Record<string, number> = {};
  for (const c of campaigns) {
    const res = await db
      .insertInto("campaigns")
      .values({
        campaign_id: c.id,
        title: c.title,
        launch_date: c.launch,
        end_date: c.end,
        critical_skus: JSON.stringify(c.critical),
        normal_skus: JSON.stringify(c.normal),
        banner_asset_link: (c.extra?.banner_asset_link as string) ?? null,
        banner_type: c.banner,
        banner_position: (c.extra?.banner_position as string) ?? null,
        brief_owner: c.owner,
        stage: c.stage as never,
        content_status: c.content as never,
        content_note: null,
        stock_readiness: c.readiness as never,
        stock_updated_at: (c.extra?.stock_updated_at as string) ?? null,
        sent_back_reason: (c.extra?.sent_back_reason as string) ?? null,
        pause_reason: (c.extra?.pause_reason as string) ?? null,
        reject_reason: (c.extra?.reject_reason as string) ?? null,
        status: (c.status as never) ?? "active",
        accepted_at: (c.extra?.accepted_at as string) ?? null,
        hub_confirmed_at: (c.extra?.hub_confirmed_at as string) ?? null,
        depots_confirmed_at: (c.extra?.depots_confirmed_at as string) ?? null,
        content_approved_at: (c.extra?.content_approved_at as string) ?? null,
        published_at: (c.extra?.published_at as string) ?? null,
        paused_at: (c.extra?.paused_at as string) ?? null,
        taken_down_at: (c.extra?.taken_down_at as string) ?? null,
        archived_at: (c.extra?.archived_at as string) ?? null,
        created_at: isoOffset(c.createdOffset),
      })
      .executeTakeFirst();
    campaignPk[c.id] = Number(res.insertId ?? 0);
  }

  // --- campaign events -----------------------------------------------------
  const events: [string, string, string, string | null, string | null, number][] = [
    ["CMP-1001", "brief_submitted", "growth", null, "Brief submitted — enters Procurement review.", -20],
    ["CMP-1001", "brief_accepted", "admin", null, "Procurement accepted brief — stock check started.", -18],
    ["CMP-1001", "stage_content", "admin", null, "All depots confirmed — moved to Content Pending.", -10],
    ["CMP-1001", "content_approved", "content", null, "Banner and notifications approved.", -6],
    ["CMP-1001", "published", "growth", null, "Campaign published — live in app.", -3],
    ["CMP-1002", "brief_submitted", "growth", null, null, -22],
    ["CMP-1002", "published", "admin", null, "Campaign published — live in app.", -2],
    ["CMP-1002", "paused", "growth", "Bundle pricing error raised by P&G team — fixing mechanics before resume.", "Paused after 1 day live.", -1],
    ["CMP-1003", "brief_submitted", "growth", null, null, -12],
    ["CMP-1003", "brief_accepted", "admin", null, null, -11],
    ["CMP-1003", "content_approved", "content", null, "Ramadan teaser banner approved.", -2],
    ["CMP-1004", "brief_submitted", "supervisor", null, null, -9],
    ["CMP-1004", "brief_accepted", "growth", null, null, -8],
    ["CMP-1005", "brief_submitted", "growth", null, null, -7],
    ["CMP-1005", "sent_back", "admin", "Hero SKU-1402 below 100% at DS_Maadi — waiting on corrected stock sheet.", null, -1],
    ["CMP-1006", "brief_submitted", "supervisor", null, null, -5],
    ["CMP-1006", "brief_accepted", "admin", null, null, -4],
    ["CMP-1007", "brief_submitted", "growth", null, null, -6],
    ["CMP-1007", "brief_accepted", "admin", null, null, -5],
    ["CMP-1008", "brief_submitted", "supervisor", null, null, -3],
    ["CMP-1008", "brief_accepted", "growth", null, null, -2],
    ["CMP-1009", "brief_submitted", "growth", null, null, -1],
    ["CMP-1010", "brief_submitted", "growth", null, null, -2],
    ["CMP-1010", "sent_back", "admin", "Critical SKU-1901 unavailable at Hub — sent back to Marketing.", null, -1],
    ["CMP-1011", "brief_submitted", "growth", null, null, -60],
    ["CMP-1011", "published", "growth", null, null, -30],
    ["CMP-1012", "brief_submitted", "supervisor", null, null, -110],
    ["CMP-1012", "published", "admin", null, null, -75],
    ["CMP-1012", "taken_down", "content", null, "Banner removed from app after end date.", -39],
    ["CMP-1012", "archived", "content", null, null, -38],
    ["CMP-1013", "brief_submitted", "growth", null, null, -8],
    ["CMP-1013", "rejected", "admin", "Margin too low after supplier review — revisit next quarter.", null, -6],
  ];
  for (const [cid, action, actor, reason, details, offset] of events) {
    await db
      .insertInto("campaign_events")
      .values({
        campaign_pk: campaignPk[cid],
        action,
        actor,
        reason,
        details,
        created_at: isoOffset(offset),
      })
      .execute();
  }

  // --- stock rows ----------------------------------------------------------
  const stock: [string, string, "Hero" | "Regular", number, number, string, number][] = [
    // CMP-1001 ready everywhere
    ["CMP-1001", "SKU-1001", "Hero", 320, 300, "Hub", -14], ["CMP-1001", "SKU-1002", "Hero", 210, 200, "Hub", -14],
    ["CMP-1001", "SKU-1003", "Hero", 150, 150, "Hub", -14], ["CMP-1001", "SKU-2001", "Regular", 400, 350, "Hub", -14],
    ["CMP-1001", "SKU-1001", "Hero", 120, 100, "DS_Zayed", -10], ["CMP-1001", "SKU-1002", "Hero", 80, 80, "DS_Zayed", -10],
    ["CMP-1001", "SKU-1003", "Hero", 60, 55, "DS_Zayed", -10], ["CMP-1001", "SKU-2001", "Regular", 190, 180, "DS_Zayed", -10],
    ["CMP-1001", "SKU-1001", "Hero", 110, 100, "DS_Maadi", -10], ["CMP-1001", "SKU-1002", "Hero", 75, 75, "DS_Maadi", -10],
    ["CMP-1001", "SKU-1003", "Hero", 55, 55, "DS_Maadi", -10], ["CMP-1001", "SKU-2002", "Regular", 160, 140, "DS_Maadi", -10],
    ["CMP-1001", "SKU-1001", "Hero", 105, 100, "DS_Kitkat", -10], ["CMP-1001", "SKU-1002", "Hero", 70, 70, "DS_Kitkat", -10],
    ["CMP-1001", "SKU-1003", "Hero", 58, 55, "DS_Kitkat", -10], ["CMP-1001", "SKU-2001", "Regular", 150, 130, "DS_Kitkat", -10],
    // CMP-1002 ready
    ["CMP-1002", "SKU-1101", "Hero", 260, 250, "Hub", -16], ["CMP-1002", "SKU-1102", "Hero", 180, 180, "Hub", -16],
    ["CMP-1002", "SKU-2101", "Regular", 300, 250, "Hub", -16],
    ["CMP-1002", "SKU-1101", "Hero", 100, 95, "DS_Zayed", -12], ["CMP-1002", "SKU-1102", "Hero", 70, 70, "DS_Zayed", -12],
    ["CMP-1002", "SKU-1101", "Hero", 98, 95, "DS_Maadi", -12], ["CMP-1002", "SKU-1102", "Hero", 66, 65, "DS_Maadi", -12],
    ["CMP-1002", "SKU-1101", "Hero", 96, 95, "DS_Kitkat", -12], ["CMP-1002", "SKU-1102", "Hero", 68, 65, "DS_Kitkat", -12],
    // CMP-1003 attention (regular below 90 at one depot)
    ["CMP-1003", "SKU-1201", "Hero", 400, 380, "Hub", -8], ["CMP-1003", "SKU-1202", "Hero", 300, 300, "Hub", -8],
    ["CMP-1003", "SKU-1203", "Hero", 220, 210, "Hub", -8], ["CMP-1003", "SKU-1204", "Hero", 190, 190, "Hub", -8],
    ["CMP-1003", "SKU-1201", "Hero", 150, 140, "DS_Zayed", -4], ["CMP-1003", "SKU-1202", "Hero", 110, 110, "DS_Zayed", -4],
    ["CMP-1003", "SKU-1203", "Hero", 90, 85, "DS_Zayed", -4], ["CMP-1003", "SKU-1204", "Hero", 75, 75, "DS_Zayed", -4],
    ["CMP-1003", "SKU-2201", "Regular", 210, 200, "DS_Zayed", -4],
    ["CMP-1003", "SKU-1201", "Hero", 145, 140, "DS_Maadi", -4], ["CMP-1003", "SKU-1202", "Hero", 108, 108, "DS_Maadi", -4],
    ["CMP-1003", "SKU-1203", "Hero", 88, 85, "DS_Maadi", -4], ["CMP-1003", "SKU-1204", "Hero", 74, 74, "DS_Maadi", -4],
    ["CMP-1003", "SKU-2201", "Regular", 150, 200, "DS_Maadi", -4],
    ["CMP-1003", "SKU-1201", "Hero", 142, 140, "DS_Kitkat", -4], ["CMP-1003", "SKU-1202", "Hero", 112, 110, "DS_Kitkat", -4],
    ["CMP-1003", "SKU-1203", "Hero", 86, 85, "DS_Kitkat", -4], ["CMP-1003", "SKU-1204", "Hero", 72, 72, "DS_Kitkat", -4],
    ["CMP-1003", "SKU-2201", "Regular", 195, 190, "DS_Kitkat", -4],
    // CMP-1004 ready
    ["CMP-1004", "SKU-1301", "Hero", 300, 280, "Hub", -6], ["CMP-1004", "SKU-1302", "Hero", 240, 240, "Hub", -6],
    ["CMP-1004", "SKU-1301", "Hero", 120, 110, "DS_Zayed", -3], ["CMP-1004", "SKU-1302", "Hero", 95, 95, "DS_Zayed", -3],
    ["CMP-1004", "SKU-2301", "Regular", 300, 260, "DS_Zayed", -3],
    ["CMP-1004", "SKU-1301", "Hero", 118, 110, "DS_Maadi", -3], ["CMP-1004", "SKU-1302", "Hero", 92, 92, "DS_Maadi", -3],
    ["CMP-1004", "SKU-1301", "Hero", 116, 110, "DS_Kitkat", -3], ["CMP-1004", "SKU-1302", "Hero", 90, 90, "DS_Kitkat", -3],
    ["CMP-1004", "SKU-2302", "Regular", 280, 240, "DS_Kitkat", -3],
    // CMP-1005 blocked: hero below 100% at DS_Maadi
    ["CMP-1005", "SKU-1401", "Hero", 220, 200, "Hub", -5], ["CMP-1005", "SKU-1402", "Hero", 180, 180, "Hub", -5],
    ["CMP-1005", "SKU-1401", "Hero", 90, 85, "DS_Zayed", -1], ["CMP-1005", "SKU-1402", "Hero", 70, 70, "DS_Zayed", -1],
    ["CMP-1005", "SKU-1401", "Hero", 80, 85, "DS_Maadi", -1], ["CMP-1005", "SKU-1402", "Hero", 60, 65, "DS_Maadi", -1],
    // DS_Kitkat rows missing → depots not confirmed
    // CMP-1006 ready at hub, waiting depots (only Zayed so far)
    ["CMP-1006", "SKU-1501", "Hero", 400, 350, "Hub", -2], ["CMP-1006", "SKU-1502", "Hero", 300, 280, "Hub", -2],
    ["CMP-1006", "SKU-1501", "Hero", 150, 130, "DS_Zayed", 0], ["CMP-1006", "SKU-1502", "Hero", 120, 115, "DS_Zayed", 0],
  ];
  for (const [cid, sku, type, inStock, required, depot, offset] of stock) {
    await db
      .insertInto("stock_rows")
      .values({
        campaign_pk: campaignPk[cid],
        sku_code: sku,
        sku_type: type,
        units_in_stock: inStock,
        units_required: required,
        depot: depot as never,
        imported_at: isoOffset(offset, 9),
      })
      .execute();
  }

  // --- notifications -------------------------------------------------------
  const notifications = [
    ["Push notification", "CMP-1003", "عروض رمضان المبكرة ابدأ التوفير اليوم مع أقوى الخصومات على السلع الأساسية.", "Early Ramadan deals are here! Start saving today on everyday essentials.", dayOffset(-1), "All users", "approved", "content", "content", -4, -3],
    ["In-app message", "CMP-1001", "عروض نهاية الأسبوع الطازجة متوفرة الآن في التطبيق.", "Weekend Fresh Deals are live now in the app — shop fresh for less.", dayOffset(-3), "All users", "approved", "content", "content", -8, -6],
    ["Push notification", "CMP-1004", "العودة للمدارس اشترِ مستلزمات أطفالك بأسعار مميزة.", "Back to School — everything your kids need at great prices.", dayOffset(2), "Parents segment", "pending_review", null, "content", -2, null],
    ["WhatsApp", "CMP-1002", "حزمة بروكتر آند جامبل المميزة اطلبها الآن.", "The P&G Mega Bundle is here — order now and save.", dayOffset(-2), "Loyal customers", "approved", "admin", "content", -5, -4],
    ["Push notification", "CMP-1005", "أسبوع الخضروات الطازجة قريباً.", "Fresh Veggie Week is coming soon — get ready for the freshest picks.", dayOffset(1), "All users", "draft", null, "content", -1, null],
    ["Abandoned cart", null, "نسيت سلة التسوق؟ أكمل طلبك الآن.", "You left items in your cart — complete your order now.", dayOffset(1), "Cart abandoners", "approved", "admin", "content", -9, -8],
    ["Recurring", null, "تذكير أسبوعي: تصفح أحدث العروض.", "Weekly reminder: browse this week's newest deals.", dayOffset(3), "All users", "pending_review", null, "content", -1, null],
    ["Push notification", "CMP-1009", "معاينة حلويات العيد قريباً.", "Eid Sweets Preview is coming — stay tuned for festive treats.", dayOffset(18), "All users", "rejected", "admin", "content", -2, -1],
  ] as const;
  for (const [type, cid, ar, en, sendAt, segment, status, reviewer, createdBy, createdOffset, reviewedOffset] of notifications) {
    await db
      .insertInto("notifications")
      .values({
        message_type: type as never,
        campaign_pk: cid ? campaignPk[cid] : null,
        ar_copy: ar as string,
        en_copy: en as string,
        planned_send_at: `${sendAt}T10:00:00`,
        target_segment: segment as string,
        status: status as never,
        reviewer: reviewer as string | null,
        review_note: status === "rejected" ? "Rewrite copy — brand tone off for Eid teaser." : null,
        created_by: createdBy as string,
        submitted_at: reviewedOffset !== null ? isoOffset(createdOffset + 1) : null,
        reviewed_at: reviewedOffset !== null ? isoOffset(reviewedOffset) : null,
        created_at: isoOffset(createdOffset),
      })
      .execute();
  }

  // --- activity logs -------------------------------------------------------
  const activity = [
    [0, "Notification triggered", ["CMP-1001"], "Sent weekend push to all users — 08:00 slot.", "growth", "CTR +12% next day"],
    [-1, "Banner repositioned", ["CMP-1002"], "Moved P&G banner to Category Top after homepage refresh.", "performance", "Session depth +8%"],
    [-2, "SKU added", ["CMP-1003"], "Added SKU-1204 to Ramadan hero list per supplier confirmation.", "performance", null],
    [-4, "Price adjusted", ["CMP-1003", "CMP-1001"], "Matched competitor pricing on 6 overlapping SKUs.", "admin", "Conversion +2pp on adjusted SKUs"],
    [-8, "Budget shifted", ["CMP-1011"], "Shifted remaining Autumn Beverages budget to high-CTR placements.", "performance", "Revenue +6% final week"],
    [-12, "Campaign paused", ["CMP-1002"], "Paused for bundle pricing fix.", "growth", null],
    [-20, "Other", ["CMP-1012"], "Post-summer retro notes attached to campaign history.", "performance", null],
  ] as const;
  for (const [offset, actionType, cids, description, owner, impact] of activity) {
    const res = await db
      .insertInto("activity_logs")
      .values({
        date: dayOffset(offset),
        action_type: actionType as never,
        description: description as string,
        owner: owner as string,
        impact: (impact as string) ?? null,
        created_at: isoOffset(offset),
      })
      .executeTakeFirst();
    const logId = Number(res.insertId ?? 0);
    for (const cid of cids) {
      await db
        .insertInto("activity_log_campaigns")
        .values({ log_id: logId, campaign_pk: campaignPk[cid] })
        .execute();
    }
  }

  // --- performance results -------------------------------------------------
  const perf: [string, number, number | null, number | null, number, string, number][] = [
    ["CMP-1011", 861000, 3.4, 2.9, 2, monthOffset(0), -1],
    ["CMP-1012", 1090000, 2.9, 2.1, 5, monthOffset(-1), -35],
    ["CMP-1001", 420000, 4.1, 3.3, 0, monthOffset(0), -1],
    ["CMP-1002", 310000, 2.2, 1.8, 1, monthOffset(0), -1],
  ];
  for (const [cid, revenue, ctr, conv, oos, period, offset] of perf) {
    await db
      .insertInto("performance_results")
      .values({
        campaign_pk: campaignPk[cid],
        actual_revenue: revenue,
        ctr,
        conversion_rate: conv,
        oos_incidents: oos,
        reporting_period: period,
        imported_at: isoOffset(offset, 12),
      })
      .execute();
  }

  // --- import history ------------------------------------------------------
  const imports = [
    ["campaign_calendar", "admin", 14, "success", null, -45],
    ["stock_values", "admin", 41, "success", null, -4],
    ["performance_results", "admin", 4, "success", null, -1],
    ["stock_values", "admin", 2, "error", "Row 3: Campaign ID \"CMP-9999\" does not exist in the portal.\nRow 5: SKU type must be Hero or Regular (got \"heroic\").", -2],
  ] as const;
  for (const [type, admin, count, status, report, offset] of imports) {
    await db
      .insertInto("import_history")
      .values({
        import_type: type as never,
        created_at: isoOffset(offset, 15),
        admin_username: admin as string,
        row_count: count,
        status: status as never,
        error_report: report as string | null,
      })
      .execute();
  }

  void planningIds;
  void parseDate;
}
