import "server-only";

import { eq } from "drizzle-orm";

import { resolveAssetUrl } from "@/lib/assets/server";
import { db } from "@/lib/db/server";

import { addresses, restaurants } from "./schema";
import type { RestaurantView } from "./validation";

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

/** Public list: restaurant fields, nested address, resolved imageUrl. No imageKey. */
export async function listRestaurants(): Promise<RestaurantView[]> {
  return await db
    .select(restaurantSelect)
    .from(restaurants)
    .innerJoin(addresses, eq(restaurants.addressId, addresses.id))
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
