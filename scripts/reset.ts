import "dotenv/config";

import { closeDatabase, db, resetDatabase } from "@/lib/db/server";

/**
 * Truncates all application tables with RESTART IDENTITY CASCADE.
 * Domain-agnostic; no production/environment confirmation guard (project scope).
 */
async function main(): Promise<void> {
  const { tableCount } = await resetDatabase(db);
  console.log(`Database reset complete (${String(tableCount)} table${tableCount === 1 ? "" : "s"} truncated).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
