"use server";

// Sheet import actions — PRD §11 (Admin only, all-or-nothing validation).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  importCampaignCalendar,
  importStockValues,
  importPerformanceResults,
  type ImportResult,
} from "@/lib/importers";
import type { ImportType } from "@/lib/types";

export type ImportActionState = (ImportResult & { importType?: ImportType }) | { error: string };

export async function runImportAction(
  _prev: ImportActionState | null,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "imports")) redirect("/403?from=imports");

  const importType = String(formData.get("import_type") ?? "") as ImportType;
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { error: "Choose a CSV file to import." };
  }
  const text = await (file as File).text();
  if (!text.trim()) return { error: "The uploaded file is empty." };

  const db = await getDb();
  let result: ImportResult;
  switch (importType) {
    case "campaign_calendar":
      result = await importCampaignCalendar(db, text, user.username);
      break;
    case "stock_values":
      result = await importStockValues(db, text, user.username);
      break;
    case "performance_results":
      result = await importPerformanceResults(db, text, user.username);
      break;
    default:
      return { error: "Unknown import type." };
  }

  revalidatePath("/", "layout");
  return { ...result, importType };
}
