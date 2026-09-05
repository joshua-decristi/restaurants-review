import { integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

import { ROLES } from "./roles";

/**
 * Private users schema. Email is stored normalized before writes; role is
 * DB-constrained to the immutable roles, with no default — every write path
 * must choose one explicitly. `name` is the required public display label.
 */
export const userRole = pgEnum("user_role", ROLES);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRole("role").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
