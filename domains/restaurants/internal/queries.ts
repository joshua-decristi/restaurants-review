import "server-only";

import { and, avg, count, desc, eq, type SQL, sql } from "drizzle-orm";

import { reviews } from "@/domains/reviews/server";
import { resolveAssetUrl } from "@/lib/assets/server";
import { db } from "@/lib/db/server";

import { addresses, restaurants } from "./schema";
import {
  resolveMinRating,
  resolveRestaurantSort,
  type RestaurantFilterOptions,
  type RestaurantListItem,
  type RestaurantListOptions,
  type RestaurantView,
} from "./validation";

/** Join shape used to build public views without leaking imageKey. */
const restaurantSelect = {
  id: restaurants.id,
  ownerId: restaurants.ownerId,
  title: restaurants.title,
  description: restaurants.description,
  cuisine: restaurants.cuisine,
  imageKey: restaurants.imageKey,
  street: addresses.street,
  city: addresses.city,
  stateRegion: addresses.stateRegion,
  postalCode: addresses.postalCode,
  country: addresses.country,
} as const;

export interface RestaurantRow {
  id: number;
  ownerId: number;
  title: string;
  description: string;
  cuisine: string;
  imageKey: string;
  street: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
}

export function toRestaurantView(row: RestaurantRow): RestaurantView {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    cuisine: row.cuisine,
    imageUrl: resolveAssetUrl(row.imageKey),
    address: {
      street: row.street,
      city: row.city,
      stateRegion: row.stateRegion,
      postalCode: row.postalCode,
      country: row.country,
    },
  };
}

/** Trim + collapse whitespace; empty strings dropped. Dedup by case-insensitive key. */
function uniqueNormalized(values: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const display = raw.trim().replace(/\s+/g, " ");
    if (display.length === 0) continue;
    const key = display.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, display);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Public browse list with live AVG/COUNT, optional filters, and best/worst sort.
 * Unrated restaurants sort last (NULLS LAST); rating ties use id DESC.
 * Unsupported sort/minRating values default safely.
 */
export async function listRestaurants(options: RestaurantListOptions = {}): Promise<RestaurantListItem[]> {
  const ratings = db
    .select({
      restaurantId: reviews.restaurantId,
      averageRating: avg(reviews.rating).as("average_rating"),
      reviewCount: count(reviews.id).as("review_count"),
    })
    .from(reviews)
    .groupBy(reviews.restaurantId)
    .as("ratings");

  const cuisine = options.cuisine?.trim().toLowerCase();
  const city = options.city?.trim().toLowerCase();
  const minRating = resolveMinRating(options.minRating);
  const conditions: SQL[] = [];

  if (cuisine) {
    conditions.push(eq(sql`lower(trim(${restaurants.cuisine}))`, cuisine));
  }
  if (city) {
    conditions.push(eq(sql`lower(trim(${addresses.city}))`, city));
  }
  if (minRating !== undefined) {
    conditions.push(sql`${ratings.averageRating} >= ${minRating}`);
  }

  const ratingOrder =
    resolveRestaurantSort(options.sort) === "worst" ? sql`${ratings.averageRating} ASC NULLS LAST` : sql`${ratings.averageRating} DESC NULLS LAST`;

  const rows = await db
    .select({
      ...restaurantSelect,
      averageRating: ratings.averageRating,
      // Left join leaves unrated rows null; coerce here so callers always get a number.
      reviewCount: sql<number>`coalesce(${ratings.reviewCount}, 0)`.mapWith(Number),
    })
    .from(restaurants)
    .innerJoin(addresses, eq(restaurants.addressId, addresses.id))
    .leftJoin(ratings, eq(ratings.restaurantId, restaurants.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ratingOrder, desc(restaurants.id));

  return rows.map((row) => ({
    ...toRestaurantView(row),
    averageRating: row.averageRating === null ? null : Number(row.averageRating),
    reviewCount: row.reviewCount,
  }));
}

/** Owner-scoped list; invalid ownerId returns []. */
export async function listRestaurantsByOwner(ownerId: number): Promise<RestaurantView[]> {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return [];

  return await db
    .select(restaurantSelect)
    .from(restaurants)
    .innerJoin(addresses, eq(restaurants.addressId, addresses.id))
    .where(eq(restaurants.ownerId, ownerId))
    .then((rows) => rows.map(toRestaurantView));
}

/** Public get-by-id; missing id returns null. */
export async function getRestaurant(id: number): Promise<RestaurantView | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return await db
    .select(restaurantSelect)
    .from(restaurants)
    .innerJoin(addresses, eq(restaurants.addressId, addresses.id))
    .where(eq(restaurants.id, id))
    .limit(1)
    .then((rows) => rows.at(0))
    .then((row) => (row === undefined ? null : toRestaurantView(row)));
}

/** Normalized, deduplicated cuisine/city values for browse filter dropdowns. */
export async function getRestaurantFilterOptions(): Promise<RestaurantFilterOptions> {
  const rows = await db
    .select({
      cuisine: restaurants.cuisine,
      city: addresses.city,
    })
    .from(restaurants)
    .innerJoin(addresses, eq(restaurants.addressId, addresses.id));

  return {
    cuisines: uniqueNormalized(rows.map((row) => row.cuisine)),
    cities: uniqueNormalized(rows.map((row) => row.city)),
  };
}
