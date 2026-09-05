import { sql } from "drizzle-orm";
import { check, foreignKey, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

// Schema-only FK targets: drizzle-kit loads this file outside Next.js, so it
// cannot import domain server entry points (server-only). Runtime still goes
// through public APIs for everything except these persistence references.
import { restaurants } from "@/domains/restaurants/internal/schema";
import { users } from "@/domains/users/internal/schema";

/** Named unique constraint mapped narrowly to `already-reviewed`. */
export const REVIEWS_REVIEWER_RESTAURANT_UNIQUE = "reviews_reviewer_restaurant_unique";

/** Explicit restaurant FK name; mapped narrowly to `not-found` on 23503. */
export const REVIEWS_RESTAURANT_ID_FK = "reviews_restaurant_id_fk";

export const reviews = pgTable(
  "reviews",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // FK declared below with a stable explicit name (not drizzle default).
    restaurantId: integer("restaurant_id").notNull(),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: REVIEWS_RESTAURANT_ID_FK,
      columns: [t.restaurantId],
      foreignColumns: [restaurants.id],
    }).onDelete("cascade"),
    unique(REVIEWS_REVIEWER_RESTAURANT_UNIQUE).on(t.reviewerId, t.restaurantId),
    check("reviews_rating_range_check", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
