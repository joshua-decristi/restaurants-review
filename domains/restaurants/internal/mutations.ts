import "server-only";

import { and, eq, sql, type WithSubquery } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { users } from "@/domains/users/server";
import { deleteAsset, uploadAsset } from "@/lib/assets/server";
import { db as rootDb } from "@/lib/db/server";

import { getRestaurant } from "./queries";
import { addresses, restaurants } from "./schema";
import {
  type CreateRestaurantInput,
  definedEntries,
  hasUpdateContent,
  parseCreateInput,
  parseUpdateInput,
  type RestaurantResult,
  type RestaurantView,
  type UpdateRestaurantInput,
  validateImage,
} from "./validation";

/**
 * PostgresJsDatabase | NeonHttpDatabase collapses `.returning(fields)` and CTE
 * overloads. PgDatabase restores the shared PostgreSQL builder surface both
 * drivers implement at runtime.
 */
const db: PgDatabase<PgQueryResultHKT> = rootDb;

async function requireOwnerUserId(userId: number): Promise<boolean> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;
  const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return rows.at(0)?.role === "owner";
}

/**
 * Best-effort asset delete: cleanup failures are swallowed. When `rethrow` is
 * set, the original error is preserved and rethrown.
 */
async function cleanupAsset(key: string, rethrow?: unknown): Promise<void> {
  await deleteAsset(key).catch(() => undefined);

  if (rethrow === undefined) return;
  // Preserve Error instances (DB failures); wrap non-Errors for the throw contract.
  throw rethrow instanceof Error ? rethrow : new Error("Restaurant mutation failed", { cause: rethrow });
}

async function loadViewOrThrow(id: number): Promise<RestaurantView> {
  const view = await getRestaurant(id);
  if (!view) throw new Error(`restaurants: expected restaurant ${String(id)} after successful write`);

  return view;
}

/**
 * Owner create: role check → upload → one CTE (address + restaurant).
 * DB failure after upload best-effort deletes the new key and rethrows.
 */
export async function createRestaurant(userId: number, input: CreateRestaurantInput, image: File): Promise<RestaurantResult<RestaurantView>> {
  const parsed = parseCreateInput(input);
  if (!parsed.ok) return { ok: false, error: "validation", issues: parsed.issues };

  const imageIssues = validateImage(image, { required: true });
  if (imageIssues.length > 0) return { ok: false, error: "validation", issues: imageIssues };
  if (!(await requireOwnerUserId(userId))) return { ok: false, error: "not-owner" };

  const imageKey = await uploadAsset(image);

  try {
    const newAddress = db.$with("new_address").as(db.insert(addresses).values(parsed.data.address).returning({ id: addresses.id }));

    const restaurant = (
      await db
        .with(newAddress)
        .insert(restaurants)
        .values({
          title: parsed.data.title,
          description: parsed.data.description,
          cuisine: parsed.data.cuisine,
          ownerId: userId,
          addressId: sql`(select id from ${newAddress})`,
          imageKey,
        })
        .returning({ id: restaurants.id })
    ).at(0);

    if (restaurant === undefined) throw new Error("restaurants.createRestaurant: insert returned no row");

    return { ok: true, data: await loadViewOrThrow(restaurant.id) };
  } catch (error) {
    await cleanupAsset(imageKey, error);
    throw error; // unreachable when cleanupAsset rethrows; satisfies control-flow analysis
  }
}

/**
 * Owner update (PATCH): owner-scoped CTE writes; optional replacement image.
 * Missing/not-owned → not-found. Image-only updates are valid.
 */
export async function updateRestaurant(
  userId: number,
  id: number,
  patch: UpdateRestaurantInput,
  replacement?: File,
): Promise<RestaurantResult<RestaurantView>> {
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(userId) || userId <= 0) return { ok: false, error: "not-found" };

  const parsed = parseUpdateInput(patch);
  if (!parsed.ok) return { ok: false, error: "validation", issues: parsed.issues };

  const imageIssues = validateImage(replacement, { required: false });
  if (imageIssues.length > 0) return { ok: false, error: "validation", issues: imageIssues };

  if (!hasUpdateContent(parsed.data, replacement)) {
    return {
      ok: false,
      error: "validation",
      issues: [{ path: "root", message: "Update requires at least one field or a replacement image." }],
    };
  }

  const addressFields = parsed.data.address === undefined ? {} : definedEntries(parsed.data.address);
  const hasAddressFields = Object.keys(addressFields).length > 0;
  const ownerScope = and(eq(restaurants.id, id), eq(restaurants.ownerId, userId));
  const restaurantFields = definedEntries({
    title: parsed.data.title,
    description: parsed.data.description,
    cuisine: parsed.data.cuisine,
  });

  let newImageKey: string | undefined;
  let previousImageKey: string | undefined;

  if (replacement) {
    const existing = (await db.select({ imageKey: restaurants.imageKey }).from(restaurants).where(ownerScope).limit(1)).at(0);
    previousImageKey = existing?.imageKey;
    newImageKey = await uploadAsset(replacement);
  }

  const restaurantSet = {
    ...restaurantFields,
    ...(newImageKey ? { imageKey: newImageKey } : {}),
  };
  const hasRestaurantSet = Object.keys(restaurantSet).length > 0;

  try {
    const target = db.$with("target").as(db.select({ addressId: restaurants.addressId }).from(restaurants).where(ownerScope));

    const ctes: WithSubquery[] = [target];
    if (hasAddressFields) {
      ctes.push(
        db.$with("updated_address").as(
          db
            .update(addresses)
            .set(addressFields)
            .where(eq(addresses.id, sql`(select address_id from ${target})`))
            .returning({ id: addresses.id }),
        ),
      );
    }

    let updatedId: number | undefined;

    if (hasRestaurantSet) {
      // Restaurant fields and/or image (with optional address CTE) — outer statement is restaurant update.
      const updated = (
        await db
          .with(...ctes)
          .update(restaurants)
          .set(restaurantSet)
          .where(ownerScope)
          .returning({ id: restaurants.id })
      ).at(0);
      updatedId = updated?.id;
    } else {
      // Address-only: outer select from target confirms ownership; address CTE already applied.
      const row = (
        await db
          .with(...ctes)
          .select({ addressId: target.addressId })
          .from(target)
      ).at(0);
      if (row !== undefined) updatedId = id;
    }

    if (updatedId === undefined) {
      if (newImageKey) await cleanupAsset(newImageKey);
      return { ok: false, error: "not-found" };
    }

    if (newImageKey && previousImageKey && previousImageKey !== newImageKey) {
      await cleanupAsset(previousImageKey);
    }

    return { ok: true, data: await loadViewOrThrow(updatedId) };
  } catch (error) {
    if (newImageKey) await cleanupAsset(newImageKey, error);
    throw error;
  }
}

/**
 * Owner delete: one CTE removes restaurant + address; image cleanup after commit.
 * Missing/not-owned → not-found (indistinguishable).
 */
export async function deleteRestaurant(userId: number, id: number): Promise<RestaurantResult<null>> {
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(userId) || userId <= 0) {
    return { ok: false, error: "not-found" };
  }

  const deleted = db.$with("deleted").as(
    db
      .delete(restaurants)
      .where(and(eq(restaurants.id, id), eq(restaurants.ownerId, userId)))
      .returning({ addressId: restaurants.addressId, imageKey: restaurants.imageKey }),
  );

  const deletedAddress = db.$with("deleted_address").as(
    db
      .delete(addresses)
      .where(eq(addresses.id, sql`(select address_id from ${deleted})`))
      .returning({ id: addresses.id }),
  );

  const row = (await db.with(deleted, deletedAddress).select({ imageKey: deleted.imageKey }).from(deleted)).at(0);

  if (row === undefined) return { ok: false, error: "not-found" };

  await cleanupAsset(row.imageKey);
  return { ok: true, data: null };
}
