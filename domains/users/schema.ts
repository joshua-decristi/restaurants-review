import { integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Private users schema: only the data credentials authentication needs.
 * `email` is stored normalized (lowercase) and unique; normalization happens
 * in users domain logic before writes. No roles or profile fields yet.
 */
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
