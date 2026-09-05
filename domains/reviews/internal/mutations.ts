import "server-only";

import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { users } from "@/domains/users/server";
import { db as rootDb } from "@/lib/db/server";

import { getPostgresConstraintError } from "./postgres-error";
import { getReview } from "./queries";
import { reviews, REVIEWS_RESTAURANT_ID_FK, REVIEWS_REVIEWER_RESTAURANT_UNIQUE } from "./schema";
import { type CreateReviewInput, parseCreateInput, parseUpdateInput, type ReviewResult, type ReviewView, type UpdateReviewInput } from "./validation";

/**
 * PostgresJsDatabase | NeonHttpDatabase collapses `.returning(fields)` overloads.
 * PgDatabase restores the shared PostgreSQL builder surface both drivers implement.
 */
const db: PgDatabase<PgQueryResultHKT> = rootDb;

function isPositiveId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

async function requireReviewerUserId(userId: number): Promise<boolean> {
  if (!isPositiveId(userId)) return false;

  return await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((rows) => rows.at(0)?.role === "reviewer");
}

async function loadViewOrThrow(id: number): Promise<ReviewView> {
  const view = await getReview(id);
  if (!view) throw new Error(`reviews: expected review ${String(id)} after successful write`);

  return view;
}

/**
 * After an owner-scoped write returns no row, distinguish missing vs foreign author.
 */
async function notFoundOrNotOwner(reviewId: number): Promise<ReviewResult<never>> {
  const exists = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1)
    .then((existing) => existing.at(0));

  if (exists) return { ok: false, error: "not-owner" };
  return { ok: false, error: "not-found" };
}

/**
 * Reviewer create: role check → insert. Unique (reviewer, restaurant) →
 * already-reviewed. Restaurant FK failure → not-found. Other DB errors propagate.
 */
export async function createReview(reviewerId: number, restaurantId: number, input: CreateReviewInput): Promise<ReviewResult<ReviewView>> {
  const parsed = parseCreateInput(input);
  if (!parsed.ok) return { ok: false, error: "validation", issues: parsed.issues };

  if (!(await requireReviewerUserId(reviewerId))) return { ok: false, error: "not-reviewer" };
  if (!isPositiveId(restaurantId)) return { ok: false, error: "not-found" };

  try {
    const inserted = await db
      .insert(reviews)
      .values({
        restaurantId,
        reviewerId,
        rating: parsed.data.rating,
        content: parsed.data.content,
      })
      .returning({ id: reviews.id })
      .then((rows) => rows.at(0));

    if (inserted === undefined) throw new Error("reviews.createReview: insert returned no row");
    return { ok: true, data: await loadViewOrThrow(inserted.id) };
  } catch (error) {
    const pg = getPostgresConstraintError(error);

    if (pg?.code === "23505" && pg.constraint === REVIEWS_REVIEWER_RESTAURANT_UNIQUE) return { ok: false, error: "already-reviewed" };
    if (pg?.code === "23503" && pg.constraint === REVIEWS_RESTAURANT_ID_FK) return { ok: false, error: "not-found" };

    throw error;
  }
}

/**
 * Author update (PATCH). Empty object is an authorized no-op (role + ownership
 * checked, no write, timestamps preserved). Non-empty updates advance updatedAt
 * via $onUpdate even when values are unchanged.
 */
export async function updateReview(reviewerId: number, reviewId: number, input: UpdateReviewInput): Promise<ReviewResult<ReviewView>> {
  if (!isPositiveId(reviewId) || !isPositiveId(reviewerId)) return { ok: false, error: "not-found" };

  const parsed = parseUpdateInput(input);
  if (!parsed.ok) return { ok: false, error: "validation", issues: parsed.issues };

  if (!(await requireReviewerUserId(reviewerId))) return { ok: false, error: "not-reviewer" };

  if (parsed.data.rating === undefined && parsed.data.content === undefined) {
    const existing = await getReview(reviewId);
    if (!existing) return { ok: false, error: "not-found" };
    if (existing.reviewerId !== reviewerId) return { ok: false, error: "not-owner" };
    return { ok: true, data: existing };
  }

  const updated = await db
    .update(reviews)
    .set(parsed.data)
    .where(and(eq(reviews.id, reviewId), eq(reviews.reviewerId, reviewerId)))
    .returning({ id: reviews.id })
    .then((rows) => rows.at(0));

  if (updated === undefined) return notFoundOrNotOwner(reviewId);
  return { ok: true, data: await loadViewOrThrow(updated.id) };
}

/**
 * Author hard-delete. Missing → not-found; foreign author → not-owner;
 * non-reviewer role → not-reviewer.
 */
export async function deleteReview(reviewerId: number, reviewId: number): Promise<ReviewResult<{ id: number }>> {
  if (!isPositiveId(reviewId) || !isPositiveId(reviewerId)) return { ok: false, error: "not-found" };
  if (!(await requireReviewerUserId(reviewerId))) return { ok: false, error: "not-reviewer" };

  const deleted = await db
    .delete(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.reviewerId, reviewerId)))
    .returning({ id: reviews.id })
    .then((rows) => rows.at(0));

  if (deleted === undefined) return notFoundOrNotOwner(reviewId);
  return { ok: true, data: { id: deleted.id } };
}
