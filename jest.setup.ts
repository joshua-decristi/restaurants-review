import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom lacks TextEncoder/TextDecoder; some dependencies expect them at import time.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

/**
 * Every test run requires a complete local environment and a local Postgres
 * database. Read process.env directly so this hook never imports server-only
 * application modules before the safety checks pass.
 *
 * Isolation policy (intentional): tests share `DATABASE_URL` with local dev.
 * There is no `TEST_DATABASE_URL`. Safety is an allowlisted hostname
 * (localhost / 127.0.0.1 / Compose service `db`) + serial `--runInBand` +
 * per-file `resetDatabase`. That truncates the same DB used by `pnpm db:seed`.
 */
beforeAll(() => {
  const required = ["DATABASE_DRIVER", "DATABASE_URL", "AUTH_SECRET"] as const;

  for (const key of required) {
    const value = process.env[key];
    if (value === undefined || value === "") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const driver = process.env.DATABASE_DRIVER;
  if (driver !== "postgres") {
    throw new Error(`DATABASE_DRIVER must be "postgres" for tests (got ${JSON.stringify(driver)}).`);
  }

  // Presence already checked in `required` above.
  const databaseUrl = process.env.DATABASE_URL ?? "";

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: ${JSON.stringify(databaseUrl)}`);
  }

  const allowedDatabaseHosts = new Set(["localhost", "127.0.0.1", "db"]);
  if (!allowedDatabaseHosts.has(hostname)) {
    throw new Error(`DATABASE_URL hostname must be localhost, 127.0.0.1, or db for tests (got ${JSON.stringify(hostname)}).`);
  }

  // TEST_DATABASE_URL is intentionally unused (project forbids a second DB URL).
  // A leftover value in .env does not redirect tests; DATABASE_URL remains authoritative.
});
