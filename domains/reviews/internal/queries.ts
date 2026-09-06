import "server-only";

import { asc, avg, count, desc, eq } from "drizzle-orm";

import { users } from "@/domains/users/server";
import { db } from "@/lib/db/server";

import { reviews } from "./schema";
import { type RatingSummary, resolveReviewSort, type ReviewRating, type ReviewSort, type ReviewView } from "./validation";

const reviewSelect = {
  id: reviews.id,
  restaurantId: reviews.restaurantId,
  reviewerId: reviews.reviewerId,
  reviewerName: users.name,
  rating: reviews.rating,
  content: reviews.content,
  createdAt: reviews.createdAt,
  updatedAt: reviews.updatedAt,
} as const;

export interface ReviewRow {
  id: number;
  restaurantId: number;
  reviewerId: number;
  reviewerName: string;
  rating: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toReviewView(row: ReviewRow): ReviewView {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    reviewerId: row.reviewerId,
    reviewerName: row.reviewerName,
    rating: row.rating as ReviewRating,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isPositiveId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

/**
 * Public list for a restaurant. Rating direction from sort (default highest);
 * always createdAt DESC, id DESC tie-breakers. Missing restaurant → empty list.
 */
export async function listReviews(restaurantId: number, sort?: ReviewSort): Promise<ReviewView[]> {
  if (!isPositiveId(restaurantId)) return [];

  const ratingOrder = resolveReviewSort(sort) === "lowest" ? asc(reviews.rating) : desc(reviews.rating);

  return await db
    .select(reviewSelect)
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.restaurantId, restaurantId))
    .orderBy(ratingOrder, desc(reviews.createdAt), desc(reviews.id))
    .then((rows) => rows.map(toReviewView));
}

/**
 * SQL AVG/COUNT over current reviews. Empty → null average, zero count.
 * Missing restaurant → ordinary empty summary.
 */
export async function getRatingSummary(restaurantId: number): Promise<RatingSummary> {
  if (!isPositiveId(restaurantId)) return { averageRating: null, reviewCount: 0 };

  const row = await db
    .select({
      averageRating: avg(reviews.rating),
      reviewCount: count(),
    })
    .from(reviews)
    .where(eq(reviews.restaurantId, restaurantId))
    .then((rows) => rows.at(0));

  const reviewCount = row?.reviewCount ?? 0;
  if (reviewCount === 0 || row?.averageRating === null || row?.averageRating === undefined) {
    return { averageRating: null, reviewCount: 0 };
  }

  // PG numeric AVG arrives as string through the driver; coerce for callers.
  return { averageRating: Number(row.averageRating), reviewCount };
}

/** Internal load-by-id with reviewer display name; missing → null. */
export async function getReview(id: number): Promise<ReviewView | null> {
  if (!isPositiveId(id)) return null;

  return await db
    .select(reviewSelect)
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .where(eq(reviews.id, id))
    .limit(1)
    .then((rows) => rows.at(0))
    .then((row) => (row === undefined ? null : toReviewView(row)));
}
