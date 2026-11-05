// Standalone seed runner: `npm run seed`.
// Idempotent — only seeds when the database is empty.

import { getDb } from "../lib/db";

async function main() {
  const db = await getDb();
  const users = await db.selectFrom("users").select(["username"]).execute();
  const campaigns = await db.selectFrom("campaigns").select(["campaign_id"]).execute();
  console.log(`Database ready. ${users.length} users, ${campaigns.length} campaigns.`);
  console.log("Demo logins (username / password):");
  console.log("  admin / Admin123!           (Admin)");
  console.log("  growth / Growth123!         (Growth Manager)");
  console.log("  supervisor / Supervisor123! (Growth Supervisor)");
  console.log("  content / Content123!       (Content Team)");
  console.log("  performance / Performance123! (Performance Member)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
