import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required by drizzle-kit. Copy .env.example to .env.");

export default defineConfig({
  dialect: "postgresql",
  // Static glob over domain schema files: a narrow tooling exception to the
  // public-interface rule. /lib/db never imports domain schemas at runtime,
  // and drizzle-kit connects with DATABASE_URL independently of the runtime
  // driver.
  schema: "./domains/**/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
});
