import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Schema-only FK target: drizzle-kit loads this file outside Next.js, so it
// cannot import domains/users/server (server-only). Runtime still goes through
// public APIs for everything except this persistence reference.
import { users } from "@/domains/users/internal/schema";

/**
 * Addresses are 1-1 with restaurants via restaurants.addressId (unique FK).
 * Kept as a separate table so other domains can reuse addresses later.
 */
export const addresses = pgTable("addresses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  stateRegion: text("state_region").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const restaurants = pgTable("restaurants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  addressId: integer("address_id")
    .notNull()
    .unique()
    .references(() => addresses.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cuisine: text("cuisine").notNull(),
  /** Provider-neutral asset key; never expose on public view models. */
  imageKey: text("image_key").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
