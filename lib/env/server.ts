import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  /**
   * Runtime driver:
   * - "development" = dev-server;
   * - "production" = production-build
   * - "test" = jest test runner
   * - "nullish" = manual seeding
   */
  NODE_ENV: z.enum(["production", "development", "test"]).optional(),
  /** Runtime database driver: local container (postgres.js) or Neon serverless. */
  DATABASE_DRIVER: z.enum(["postgres", "neon"]),
  /** PostgreSQL connection string for the selected runtime driver. */
  DATABASE_URL: z.url(),
  /** Auth.js session secret; generate with `openssl rand -base64 32`. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32"),
  /**
   * Asset storage backend. Defaults to local disk for demo/dev.
   * UploadThing credentials are validated only when this is `uploadthing`.
   */
  ASSET_PROVIDER: z.enum(["disk", "uploadthing"]).default("disk"),
  /** Local disk root for ASSET_PROVIDER=disk. Relative paths resolve from cwd. */
  ASSET_DISK_DIR: z.string().min(1).default(".local-assets"),
  /**
   * UploadThing API token (base64 JSON). Optional at boot; required lazily when
   * ASSET_PROVIDER=uploadthing performs network operations or URL resolution.
   */
  UPLOADTHING_TOKEN: z.string().optional(),
});

const seedEnvSchema = z.object({
  /** Seeded reviewer-account login (non-secret example values). */
  REVIEWER_USER_EMAIL: z.email(),
  REVIEWER_USER_PASSWORD: z.string().min(8),
  /** Seeded owner-account login (non-secret example values). */
  OWNER_USER_EMAIL: z.email(),
  OWNER_USER_PASSWORD: z.string().min(8),
});

/**
 * Fail-fast, Zod-validated server-private environment values.
 * Consumers read these values here and never access `process.env` directly.
 * Parsing runs once when this module is loaded.
 */
export const serverEnv = serverEnvSchema.parse(process.env);

/**
 * Seed-only environment values, validated lazily on invocation so normal
 * app startup and builds never require them; only the seed script calls this.
 */
export function getSeedEnv() {
  return seedEnvSchema.parse(process.env);
}
