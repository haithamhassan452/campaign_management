// Database access layer.
//
// Dual-dialect by design so the same MVP runs everywhere:
//   - Local dev:        SQLite file (data/portal.sqlite) via node:sqlite when DATABASE_URL is unset.
//   - Vercel / prod:    Postgres (Vercel Postgres, Neon, Supabase...) via DATABASE_URL.
//
// Kysely generates dialect-correct SQL from the same query builder code.
// Schema is created idempotently on first access and demo data is seeded when
// the DB is empty, so a fresh deploy is immediately usable.

import fs from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { createSqliteDialect } from "./node-sqlite";
import type {
  UserTable,
  CampaignTable,
  CampaignEventTable,
  PlanningTable,
  StockTable,
  NotificationTable,
  ActivityLogTable,
  ActivityLogCampaignTable,
  PerformanceResultTable,
  ImportHistoryTable,
} from "./types";

export interface Database {
  users: UserTable;
  campaigns: CampaignTable;
  campaign_events: CampaignEventTable;
  planning_entries: PlanningTable;
  stock_rows: StockTable;
  notifications: NotificationTable;
  activity_logs: ActivityLogTable;
  activity_log_campaigns: ActivityLogCampaignTable;
  performance_results: PerformanceResultTable;
  import_history: ImportHistoryTable;
}

export type AppDatabase = Kysely<Database>;

const globalForDb = globalThis as unknown as {
  __cmpDb?: AppDatabase;
  __cmpDbReady?: Promise<AppDatabase>;
};

function sqliteDdl(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      launch_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      critical_skus TEXT NOT NULL DEFAULT '[]',
      normal_skus TEXT NOT NULL DEFAULT '[]',
      banner_asset_link TEXT,
      banner_type TEXT,
      banner_position TEXT,
      brief_owner TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'in_pipeline',
      content_status TEXT NOT NULL DEFAULT 'awaiting',
      content_note TEXT,
      stock_readiness TEXT NOT NULL DEFAULT 'no_data',
      stock_updated_at TEXT,
      sent_back_reason TEXT,
      pause_reason TEXT,
      reject_reason TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      accepted_at TEXT,
      hub_confirmed_at TEXT,
      depots_confirmed_at TEXT,
      content_approved_at TEXT,
      published_at TEXT,
      paused_at TEXT,
      taken_down_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_pk INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS planning_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      theme TEXT NOT NULL,
      period TEXT NOT NULL,
      planned_launch_date TEXT NOT NULL,
      planned_end_date TEXT NOT NULL,
      revenue_target REAL NOT NULL,
      owner TEXT NOT NULL,
      notes TEXT,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS stock_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_pk INTEGER NOT NULL,
      sku_code TEXT NOT NULL,
      sku_type TEXT NOT NULL,
      units_in_stock INTEGER NOT NULL,
      units_required INTEGER NOT NULL,
      depot TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_type TEXT NOT NULL,
      campaign_pk INTEGER,
      ar_copy TEXT NOT NULL,
      en_copy TEXT NOT NULL,
      planned_send_at TEXT NOT NULL,
      target_segment TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      reviewer TEXT,
      review_note TEXT,
      created_by TEXT NOT NULL,
      submitted_at TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      impact TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id INTEGER NOT NULL,
      campaign_pk INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS performance_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_pk INTEGER NOT NULL,
      actual_revenue REAL NOT NULL,
      ctr REAL,
      conversion_rate REAL,
      oos_incidents INTEGER NOT NULL DEFAULT 0,
      reporting_period TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      admin_username TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_report TEXT
    )`,
  ];
}

function postgresDdl(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      campaign_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      launch_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      critical_skus TEXT NOT NULL DEFAULT '[]',
      normal_skus TEXT NOT NULL DEFAULT '[]',
      banner_asset_link TEXT,
      banner_type TEXT,
      banner_position TEXT,
      brief_owner TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'in_pipeline',
      content_status TEXT NOT NULL DEFAULT 'awaiting',
      content_note TEXT,
      stock_readiness TEXT NOT NULL DEFAULT 'no_data',
      stock_updated_at TEXT,
      sent_back_reason TEXT,
      pause_reason TEXT,
      reject_reason TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      accepted_at TEXT,
      hub_confirmed_at TEXT,
      depots_confirmed_at TEXT,
      content_approved_at TEXT,
      published_at TEXT,
      paused_at TEXT,
      taken_down_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_events (
      id SERIAL PRIMARY KEY,
      campaign_pk INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS planning_entries (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      theme TEXT NOT NULL,
      period TEXT NOT NULL,
      planned_launch_date TEXT NOT NULL,
      planned_end_date TEXT NOT NULL,
      revenue_target DOUBLE PRECISION NOT NULL,
      owner TEXT NOT NULL,
      notes TEXT,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS stock_rows (
      id SERIAL PRIMARY KEY,
      campaign_pk INTEGER NOT NULL,
      sku_code TEXT NOT NULL,
      sku_type TEXT NOT NULL,
      units_in_stock INTEGER NOT NULL,
      units_required INTEGER NOT NULL,
      depot TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      message_type TEXT NOT NULL,
      campaign_pk INTEGER,
      ar_copy TEXT NOT NULL,
      en_copy TEXT NOT NULL,
      planned_send_at TEXT NOT NULL,
      target_segment TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      reviewer TEXT,
      review_note TEXT,
      created_by TEXT NOT NULL,
      submitted_at TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      impact TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log_campaigns (
      id SERIAL PRIMARY KEY,
      log_id INTEGER NOT NULL,
      campaign_pk INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS performance_results (
      id SERIAL PRIMARY KEY,
      campaign_pk INTEGER NOT NULL,
      actual_revenue DOUBLE PRECISION NOT NULL,
      ctr DOUBLE PRECISION,
      conversion_rate DOUBLE PRECISION,
      oos_incidents INTEGER NOT NULL DEFAULT 0,
      reporting_period TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS import_history (
      id SERIAL PRIMARY KEY,
      import_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      admin_username TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_report TEXT
    )`,
  ];
}

async function createDb(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL;
  let db: AppDatabase;
  let dialectName: "sqlite" | "postgres";

  if (databaseUrl) {
    dialectName = "postgres";
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      // Neon / Supabase serverless-friendly TLS
      ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    });
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  } else {
    dialectName = "sqlite";
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Kysely<Database>({
      dialect: createSqliteDialect(path.join(dataDir, "portal.sqlite")),
    });
  }

  const ddl = dialectName === "postgres" ? postgresDdl() : sqliteDdl();
  for (const stmt of ddl) {
    await sql.raw(stmt).execute(db);
  }

  return db;
}

export async function getDb(): Promise<AppDatabase> {
  if (globalForDb.__cmpDb) return globalForDb.__cmpDb;
  if (!globalForDb.__cmpDbReady) {
    globalForDb.__cmpDbReady = (async () => {
      const db = await createDb();
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      globalForDb.__cmpDb = db;
      return db;
    })();
  }
  return globalForDb.__cmpDbReady;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
