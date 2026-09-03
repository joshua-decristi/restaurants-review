import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  /** Runtime database driver: local container (postgres.js) or Neon serverless. */
  DATABASE_DRIVER: z.enum(["postgres", "neon"]),
  /** PostgreSQL connection string for the selected runtime driver. */
  DATABASE_URL: z.url(),
  /** Auth.js session secret; generate with `openssl rand -base64 32`. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32"),
});

const seedEnvSchema = z.object({
  /** Seeded development user login (non-secret example values). */
  DEVELOPMENT_USER_EMAIL: z.email(),
  DEVELOPMENT_USER_PASSWORD: z.string().min(8),
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
