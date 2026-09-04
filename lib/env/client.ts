"use client";

import { z } from "zod";

const clientEnvSchema = z.object({
  /** Runtime driver: local container or production serverless. */
  NODE_ENV: z.enum(["development", "production"]),
});

/**
 * Fail-fast, Zod-validated server-private environment values.
 * Consumers read these values here and never access `process.env` directly.
 * Parsing runs once when this module is loaded.
 */
export const clientEnv = clientEnvSchema.parse({ ...process.env, NODE_ENV: process.env.NODE_ENV });
