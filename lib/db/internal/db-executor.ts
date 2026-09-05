import type { Database } from "./init";

/**
 * Minimal executor accepted by factories and scripts: the root database client
 * or a transaction handle. Covers both configured Drizzle drivers without
 * importing domain schemas.
 */
export interface DbExecutor {
  insert: Database["insert"];
  select: Database["select"];
  update: Database["update"];
  delete: Database["delete"];
  execute: Database["execute"];
}
