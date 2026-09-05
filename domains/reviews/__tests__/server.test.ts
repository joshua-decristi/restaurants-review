/**
 * Public reviews domain integration contracts.
 *
 * @jest-environment node
 */

import { eq, sql } from "drizzle-orm";

import { deleteRestaurant, restaurants, restaurantsFactory } from "@/domains/restaurants/server";
import {
  createReview,
  type CreateReviewInput,
  deleteReview,
  getRatingSummary,
  listReviews,
  reviews,
  REVIEWS_REVIEWER_RESTAURANT_UNIQUE,
  reviewsFactory,
  updateReview,
} from "@/domains/reviews/server";
import { usersFactory } from "@/domains/users/server";
import * as assets from "@/lib/assets/server";
import { closeDatabase, db, resetDatabase } from "@/lib/db/server";

jest.mock("@/lib/assets/server", () => ({
  uploadAsset: jest.fn((file: File) => Promise.resolve(`key-${file.name}-${String(file.size)}`)),
  deleteAsset: jest.fn(() => Promise.resolve(undefined)),
  resolveAssetUrl: jest.fn((key: string) => `/api/assets/${encodeURIComponent(key)}`),
  resetLocalAssets: jest.fn(() => Promise.resolve(undefined)),
  readLocalAsset: jest.fn(() => Promise.resolve(null)),
}));

const uploadAsset = jest.mocked(assets.uploadAsset);
const deleteAsset = jest.mocked(assets.deleteAsset);
const resolveAssetUrl = jest.mocked(assets.resolveAssetUrl);

/** Unseeded factories so concurrent cases never collide on deterministic emails. */
const usersApi = () => usersFactory(db);
const restaurantsApi = () => restaurantsFactory(db);
const reviewsApi = () => reviewsFactory(db);

function validInput(overrides: Partial<CreateReviewInput> = {}): CreateReviewInput {
  return { rating: 5, content: "Excellent noodles and broth.", ...overrides };
}

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  jest.clearAllMocks();
  uploadAsset.mockImplementation((file: File) => Promise.resolve(`key-${file.name}-${String(file.size)}`));
  deleteAsset.mockImplementation(() => Promise.resolve(undefined));
  resolveAssetUrl.mockImplementation((key: string) => `/api/assets/${encodeURIComponent(key)}`);
});

afterAll(async () => {
  await closeDatabase();
});

describe("public reads", () => {
  it("lists display-safe reviews with reviewerId and reviewerName, never email/password", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer", name: "Ada Reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      reviewerId: reviewer.id,
      rating: 4,
      content: "Solid meal.",
    });

    const listed = await listReviews(restaurant.id);
    const row = listed.find((r) => r.id === created.id);
    expect(row).toBeDefined();
    if (row === undefined) return;

    expect(row).toMatchObject({
      restaurantId: restaurant.id,
      reviewerId: reviewer.id,
      reviewerName: "Ada Reviewer",
      rating: 4,
      content: "Solid meal.",
    });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect(row).not.toHaveProperty("email");
    expect(row).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(row)).not.toContain(reviewer.email);
    expect(JSON.stringify(row)).not.toContain("password");
  });

  it("orders by rating DESC, then createdAt DESC, then id DESC", async () => {
    const restaurant = await restaurantsApi().fakeRestaurant();
    const t1 = new Date("2024-01-01T12:00:00.000Z");
    const t2 = new Date("2024-01-02T12:00:00.000Z");
    const t3 = new Date("2024-01-03T12:00:00.000Z");

    // Lower rating first insert (should sort last).
    const low = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 2,
      content: "low",
      createdAt: t3,
    });
    // Same high rating, older createdAt.
    const olderHigh = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 5,
      content: "older-high",
      createdAt: t1,
    });
    // Same high rating, newer createdAt — wins over olderHigh.
    const newerHigh = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 5,
      content: "newer-high",
      createdAt: t2,
    });
    // Mid rating.
    const mid = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 3,
      content: "mid",
      createdAt: t3,
    });

    // Two equal rating+createdAt rows: higher id first (id DESC tie-break).
    const tieA = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 4,
      content: "tie-a",
      createdAt: t1,
    });
    const tieB = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      rating: 4,
      content: "tie-b",
      createdAt: t1,
    });

    const listed = await listReviews(restaurant.id);
    const ids = listed.map((r) => r.id);
    expect(ids).toEqual([newerHigh.id, olderHigh.id, tieB.id, tieA.id, mid.id, low.id]);
  });

  it("returns [] and empty summary for a missing restaurant", async () => {
    expect(await listReviews(9_999_999)).toEqual([]);
    expect(await getRatingSummary(9_999_999)).toEqual({ averageRating: null, reviewCount: 0 });
  });

  it("returns null average and zero count when empty; JS numbers when non-empty", async () => {
    const restaurant = await restaurantsApi().fakeRestaurant();
    expect(await getRatingSummary(restaurant.id)).toEqual({ averageRating: null, reviewCount: 0 });

    await reviewsApi().fakeReview({ restaurantId: restaurant.id, rating: 4, content: "a" });
    await reviewsApi().fakeReview({ restaurantId: restaurant.id, rating: 5, content: "b" });

    const summary = await getRatingSummary(restaurant.id);
    expect(summary.reviewCount).toBe(2);
    expect(typeof summary.averageRating).toBe("number");
    expect(summary.averageRating).toBe(4.5);
  });
});

describe("create", () => {
  it("creates a valid trimmed review for a reviewer", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer", name: "Create User" });
    const restaurant = await restaurantsApi().fakeRestaurant();

    const result = await createReview(reviewer.id, restaurant.id, {
      rating: 5,
      content: "  Trimmed content stays meaningful.  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      restaurantId: restaurant.id,
      reviewerId: reviewer.id,
      reviewerName: "Create User",
      rating: 5,
      content: "Trimmed content stays meaningful.",
    });
  });

  it("returns not-reviewer for an owner", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const restaurant = await restaurantsApi().fakeRestaurant({ ownerId: owner.id });

    const denied = await createReview(owner.id, restaurant.id, validInput());
    expect(denied).toEqual({ ok: false, error: "not-reviewer" });
    expect(await listReviews(restaurant.id)).toEqual([]);
  });

  it("returns not-reviewer for a missing positive reviewer id", async () => {
    const restaurant = await restaurantsApi().fakeRestaurant();
    const missingId = 9_999_999;

    await expect(createReview(missingId, restaurant.id, validInput())).resolves.toEqual({
      ok: false,
      error: "not-reviewer",
    });
    await expect(updateReview(missingId, 1, { rating: 1 })).resolves.toEqual({
      ok: false,
      error: "not-reviewer",
    });
    await expect(deleteReview(missingId, 1)).resolves.toEqual({ ok: false, error: "not-reviewer" });
  });

  it("maps the named unique constraint to already-reviewed and leaves one row", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();

    const first = await createReview(reviewer.id, restaurant.id, validInput({ content: "first" }));
    expect(first.ok).toBe(true);

    const second = await createReview(reviewer.id, restaurant.id, validInput({ content: "second" }));
    expect(second).toEqual({ ok: false, error: "already-reviewed" });

    const rows = await db.select().from(reviews).where(eq(reviews.restaurantId, restaurant.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe("first");

    // Named unique constraint exists so the mutation can map it narrowly.
    const constraintRows = await db.execute(sql`
      SELECT 1 AS ok
      FROM pg_constraint
      WHERE conname = ${REVIEWS_REVIEWER_RESTAURANT_UNIQUE}
    `);
    expect(Array.isArray(constraintRows) ? constraintRows.length : 0).toBeGreaterThan(0);
  });

  it("returns not-found when the restaurant is missing (FK mapping)", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const missing = await createReview(reviewer.id, 9_999_999, validInput());
    expect(missing).toEqual({ ok: false, error: "not-found" });
  });

  it.each([
    [{ rating: 0, content: "valid" }, "rating"],
    [{ rating: 6, content: "valid" }, "rating"],
    [{ rating: 1.5, content: "valid" }, "rating"],
    [{ rating: 5, content: "   " }, "content"],
  ] as const)("rejects invalid create input %#", async (input, field) => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const result = await createReview(reviewer.id, restaurant.id, input as CreateReviewInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("validation");
    expect(result.issues?.some((issue) => issue.path === field)).toBe(true);
  });

  it("accepts rating and content boundaries", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();

    const min = await createReview(reviewer.id, restaurant.id, { rating: 1, content: "x" });
    expect(min.ok).toBe(true);

    const reviewer2 = await usersApi().fakeUser({ role: "reviewer" });
    const max = await createReview(reviewer2.id, restaurant.id, { rating: 5, content: "c".repeat(2000) });
    expect(max.ok).toBe(true);

    const reviewer3 = await usersApi().fakeUser({ role: "reviewer" });
    const tooLong = await createReview(reviewer3.id, restaurant.id, { rating: 3, content: "c".repeat(2001) });
    expect(tooLong).toMatchObject({ ok: false, error: "validation" });
  });
});

describe("update and delete", () => {
  it("partially updates rating or content; preserves omitted values and createdAt", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await createReview(reviewer.id, restaurant.id, {
      rating: 3,
      content: "Original body",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const createdAt = created.data.createdAt;

    const ratingOnly = await updateReview(reviewer.id, created.data.id, { rating: 5 });
    expect(ratingOnly.ok).toBe(true);
    if (!ratingOnly.ok) return;
    expect(ratingOnly.data.rating).toBe(5);
    expect(ratingOnly.data.content).toBe("Original body");
    expect(ratingOnly.data.createdAt).toEqual(createdAt);

    const contentOnly = await updateReview(reviewer.id, created.data.id, { content: "Revised body" });
    expect(contentOnly.ok).toBe(true);
    if (!contentOnly.ok) return;
    expect(contentOnly.data.content).toBe("Revised body");
    expect(contentOnly.data.rating).toBe(5);
    expect(contentOnly.data.createdAt).toEqual(createdAt);

    const summary = await getRatingSummary(restaurant.id);
    expect(summary).toEqual({ averageRating: 5, reviewCount: 1 });
  });

  it("authorized empty update checks role/ownership and preserves timestamps", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const other = await usersApi().fakeUser({ role: "reviewer" });
    const owner = await usersApi().fakeUser({ role: "owner" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await createReview(reviewer.id, restaurant.id, validInput({ content: "stable" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = created.data;

    const empty = await updateReview(reviewer.id, created.data.id, {});
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data.updatedAt).toEqual(before.updatedAt);
    expect(empty.data.createdAt).toEqual(before.createdAt);
    expect(empty.data.content).toBe("stable");

    expect(await updateReview(other.id, created.data.id, {})).toEqual({ ok: false, error: "not-owner" });
    expect(await updateReview(owner.id, created.data.id, {})).toEqual({ ok: false, error: "not-reviewer" });
    expect(await updateReview(owner.id, created.data.id, { rating: 1 })).toEqual({ ok: false, error: "not-reviewer" });
    expect(await deleteReview(owner.id, created.data.id)).toEqual({ ok: false, error: "not-reviewer" });
    expect(await updateReview(reviewer.id, 9_999_999, {})).toEqual({ ok: false, error: "not-found" });
  });

  it("non-empty update advances updatedAt even with identical values", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await createReview(reviewer.id, restaurant.id, validInput({ rating: 4, content: "same" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Ensure clock can move past insert time for timestamp comparison.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const same = await updateReview(reviewer.id, created.data.id, { rating: 4, content: "same" });
    expect(same.ok).toBe(true);
    if (!same.ok) return;
    expect(same.data.createdAt).toEqual(created.data.createdAt);
    expect(same.data.updatedAt.getTime()).toBeGreaterThan(created.data.updatedAt.getTime());
  });

  it("returns not-owner for another reviewer and not-found for missing", async () => {
    const author = await usersApi().fakeUser({ role: "reviewer" });
    const other = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await createReview(author.id, restaurant.id, validInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await updateReview(other.id, created.data.id, { rating: 1 })).toEqual({ ok: false, error: "not-owner" });
    expect(await updateReview(author.id, 9_999_999, { rating: 1 })).toEqual({ ok: false, error: "not-found" });
  });

  it("author deletes; another reviewer cannot; summary updates", async () => {
    const author = await usersApi().fakeUser({ role: "reviewer" });
    const other = await usersApi().fakeUser({ role: "reviewer" });
    const restaurant = await restaurantsApi().fakeRestaurant();
    const created = await createReview(author.id, restaurant.id, validInput({ rating: 5 }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await getRatingSummary(restaurant.id)).toEqual({ averageRating: 5, reviewCount: 1 });

    expect(await deleteReview(other.id, created.data.id)).toEqual({ ok: false, error: "not-owner" });
    expect(await listReviews(restaurant.id)).toHaveLength(1);

    const deleted = await deleteReview(author.id, created.data.id);
    expect(deleted).toEqual({ ok: true, data: { id: created.data.id } });
    expect(await listReviews(restaurant.id)).toEqual([]);
    expect(await getRatingSummary(restaurant.id)).toEqual({ averageRating: null, reviewCount: 0 });

    expect(await deleteReview(author.id, created.data.id)).toEqual({ ok: false, error: "not-found" });
  });
});

describe("relational behavior", () => {
  it("deleting a restaurant cascades its reviews", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const restaurant = await restaurantsApi().fakeRestaurant({ ownerId: owner.id });
    await reviewsApi().fakeReview({ restaurantId: restaurant.id, rating: 5, content: "cascade me" });
    await reviewsApi().fakeReview({ restaurantId: restaurant.id, rating: 3, content: "cascade me too" });

    expect(await listReviews(restaurant.id)).toHaveLength(2);

    const deleted = await deleteRestaurant(owner.id, restaurant.id);
    expect(deleted).toEqual({ ok: true, data: null });

    expect(await listReviews(restaurant.id)).toEqual([]);
    expect(await getRatingSummary(restaurant.id)).toEqual({ averageRating: null, reviewCount: 0 });

    const leftover = await db.select().from(reviews).where(eq(reviews.restaurantId, restaurant.id));
    expect(leftover).toHaveLength(0);

    // Restaurant row is gone.
    const restaurantRows = await db.select().from(restaurants).where(eq(restaurants.id, restaurant.id));
    expect(restaurantRows).toHaveLength(0);
  });
});

describe("factory", () => {
  it("creates fixtures, validates reviewerId, and supports scalar overrides", async () => {
    const reviewer = await usersApi().fakeUser({ role: "reviewer", name: "Factory Reviewer" });
    const owner = await usersApi().fakeUser({ role: "owner" });
    const restaurant = await restaurantsApi().fakeRestaurant({ ownerId: owner.id });

    const explicit = await reviewsApi().fakeReview({
      restaurantId: restaurant.id,
      reviewerId: reviewer.id,
      rating: 2,
      content: "Explicit",
    });
    expect(explicit).toMatchObject({
      restaurantId: restaurant.id,
      reviewerId: reviewer.id,
      reviewerName: "Factory Reviewer",
      rating: 2,
      content: "Explicit",
    });

    const before = (await db.select().from(reviews)).length;
    await expect(reviewsApi().fakeReview({ restaurantId: restaurant.id, reviewerId: owner.id })).rejects.toThrow(/reviewer/i);
    expect((await db.select().from(reviews)).length).toBe(before);

    const implicit = await reviewsApi().fakeReview({ content: "Implicit parents" });
    expect(implicit.restaurantId).toEqual(expect.any(Number));
    expect(implicit.reviewerId).toEqual(expect.any(Number));
    expect(implicit.content).toBe("Implicit parents");

    // Deterministic seed with distinct restaurants (unique reviewer/restaurant pairs).
    const restaurantA = await restaurantsApi().fakeRestaurant({ ownerId: owner.id });
    const restaurantB = await restaurantsApi().fakeRestaurant({ ownerId: owner.id });
    const a = await reviewsFactory(db, { seed: 7 }).fakeReview({
      restaurantId: restaurantA.id,
      reviewerId: reviewer.id,
    });
    const b = await reviewsFactory(db, { seed: 7 }).fakeReview({
      restaurantId: restaurantB.id,
      reviewerId: reviewer.id,
    });
    expect(a.rating).toEqual(b.rating);
    expect(a.content).toEqual(b.content);
  });
});
