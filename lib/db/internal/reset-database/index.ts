import "server-only";

import { sql } from "drizzle-orm";

import type { DbExecutor } from "../db-executor";
import { db } from "../init";

export interface ResetDatabaseResult {
  /** Application tables truncated (0 when the schema has none yet). */
  tableCount: number;
}

/**
 * Normalizes Drizzle `execute` results across drivers:
 * - postgres.js returns a row array
 * - Neon HTTP returns `{ rows: [...] }`
 * Unrecognized shapes throw instead of silently yielding zero tables.
 */
function isRowArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((row) => row !== null && typeof row === "object");
}

export function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (isRowArray(result)) return result;

  if (result !== null && typeof result === "object" && "rows" in result) {
    const rows = Reflect.get(result, "rows");
    if (isRowArray(rows)) return rows;
  }

  throw new Error(`Unrecognized database execute result shape: ${Object.prototype.toString.call(result)}`);
}

/**
 * Truncates every application table in the public schema with
 * `RESTART IDENTITY CASCADE`. Excludes Drizzle migration metadata.
 * Domain-agnostic: discovers tables at runtime rather than importing schemas.
 */
export async function resetDatabase(executor: DbExecutor = db): Promise<ResetDatabaseResult> {
  const result = await executor.execute(sql`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind = 'r'
      AND c.relname <> '__drizzle_migrations'
      AND c.relname NOT LIKE 'drizzle_%'
  `);

  const tables = rowsFromExecute(result)
    .map((row) => (typeof row.table_name === "string" ? row.table_name : undefined))
    .filter((name): name is string => name !== undefined);

  if (tables.length === 0) return { tableCount: 0 };

  const quoted = tables.map((name) => `"${name.replaceAll('"', '""')}"`).join(", ");
  await executor.execute(sql.raw(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`));
  return { tableCount: tables.length };
}
