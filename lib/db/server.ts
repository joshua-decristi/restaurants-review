import "server-only";

import { getLogger as getDrizzleLogger } from "@logtape/drizzle-orm";
import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/env/server";

/**
 * Driver-agnostic Drizzle PostgreSQL database. Both driver databases extend
 * the same `PgDatabase` base, so callers use one interface and never branch
 * on the environment.
 */
export type Database = PostgresJsDatabase | NeonHttpDatabase;

let postgresClient: postgres.Sql | undefined;

function createDatabase(): Database {
  switch (serverEnv.DATABASE_DRIVER) {
    case "postgres": {
      postgresClient = postgres(serverEnv.DATABASE_URL);

      if (serverEnv.NODE_ENV === "development")
        // Only add logging in development mode
        return drizzlePostgresJs(postgresClient, { logger: getDrizzleLogger({ category: "database" }) });

      return drizzlePostgresJs(postgresClient);
    }

    case "neon":
      return drizzleNeon(neon(serverEnv.DATABASE_URL));
  }
}

/** Server-only database access for domain server interfaces and adapters. */
export const db: Database = createDatabase();

/**
 * Closes the runtime driver's connections so script processes can exit; a
 * no-op for the serverless Neon driver.
 */
export async function closeDatabase(): Promise<void> {
  await postgresClient?.end();
}
