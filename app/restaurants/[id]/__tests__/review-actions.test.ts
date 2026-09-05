/**
 * Focused Server Action transport tests: session-derived identity, typed error
 * mapping, and detail-path revalidation. Domain rules live in domains/reviews.
 *
 * @jest-environment node
 */

import { revalidatePath } from "next/cache";

import { createReview, deleteReview, updateReview } from "@/domains/reviews/server";
import { getSession } from "@/lib/auth/server";

import { createReviewAction, deleteReviewAction, type ReviewActionState, updateReviewAction } from "../review-actions";

/** Mirror of the actions module seed (kept private there; "use server" cannot export values). */
const initialReviewActionState: ReviewActionState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

jest.mock("@/lib/auth/server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/domains/reviews/server", () => ({
  createReview: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const getSessionMock = jest.mocked(getSession);
const createReviewMock = jest.mocked(createReview);
const updateReviewMock = jest.mocked(updateReview);
const deleteReviewMock = jest.mocked(deleteReview);
const revalidatePathMock = jest.mocked(revalidatePath);

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const sampleView = {
  id: 11,
  restaurantId: 3,
  reviewerId: 42,
  reviewerName: "Alex Reviewer",
  rating: 5 as const,
  content: "Great noodles",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createReviewAction", () => {
  it("returns unauthorized without a session and does not call the domain", async () => {
    getSessionMock.mockResolvedValue(null);

    const state = await createReviewAction(initialReviewActionState, form({ restaurantId: "3", rating: "5", content: "Great noodles" }));

    expect(state).toEqual({
      ok: false,
      error: "You must be signed in to manage reviews.",
      fieldErrors: {},
    });
    expect(createReviewMock).not.toHaveBeenCalled();
  });

  it("passes the session userId to the domain and ignores form reviewer fields", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    createReviewMock.mockResolvedValue({ ok: true, data: sampleView });

    const state = await createReviewAction(
      initialReviewActionState,
      form({
        restaurantId: "3",
        rating: "5",
        content: "Great noodles",
        reviewerId: "999",
        userId: "999",
      }),
    );

    expect(state).toEqual({ ok: true, error: null, fieldErrors: {} });
    expect(createReviewMock).toHaveBeenCalledWith(42, 3, { rating: 5, content: "Great noodles" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/restaurants/3");
  });

  it("maps domain not-reviewer failures to stable form state", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "owner@example.com", role: "owner" } });
    createReviewMock.mockResolvedValue({ ok: false, error: "not-reviewer" });

    const state = await createReviewAction(initialReviewActionState, form({ restaurantId: "3", rating: "4", content: "Nice place" }));

    expect(state).toEqual({
      ok: false,
      error: "Only reviewers can perform this action.",
      fieldErrors: {},
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("maps already-reviewed and validation field issues", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    createReviewMock.mockResolvedValueOnce({ ok: false, error: "already-reviewed" });

    const duplicate = await createReviewAction(initialReviewActionState, form({ restaurantId: "3", rating: "5", content: "Again" }));
    expect(duplicate.error).toBe("You have already reviewed this restaurant.");

    createReviewMock.mockResolvedValueOnce({
      ok: false,
      error: "validation",
      issues: [{ path: "content", message: "Too short" }],
    });
    const invalid = await createReviewAction(initialReviewActionState, form({ restaurantId: "3", rating: "5", content: "   " }));
    expect(invalid).toEqual({
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: { content: "Too short" },
    });
  });

  it("rejects a non-numeric restaurant id without calling the domain", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });

    const state = await createReviewAction(initialReviewActionState, form({ restaurantId: "abc", rating: "5", content: "Great" }));

    expect(state.error).toBe("Review not found.");
    expect(createReviewMock).not.toHaveBeenCalled();
  });
});

describe("updateReviewAction", () => {
  it("returns unauthorized without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const state = await updateReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3", rating: "4", content: "Updated" }));

    expect(state.error).toBe("You must be signed in to manage reviews.");
    expect(updateReviewMock).not.toHaveBeenCalled();
  });

  it("passes session userId and review id, ignoring form reviewer fields", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    updateReviewMock.mockResolvedValue({ ok: true, data: { ...sampleView, rating: 4, content: "Updated" } });

    const state = await updateReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3", rating: "4", content: "Updated", reviewerId: "999" }));

    expect(state.ok).toBe(true);
    expect(updateReviewMock).toHaveBeenCalledWith(42, 11, { rating: 4, content: "Updated" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/restaurants/3");
  });

  it("maps not-owner failures to stable form state", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "8", email: "other@example.com", role: "reviewer" } });
    updateReviewMock.mockResolvedValue({ ok: false, error: "not-owner" });

    const state = await updateReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3", rating: "3", content: "Nope" }));

    expect(state).toEqual({
      ok: false,
      error: "You can only modify your own review.",
      fieldErrors: {},
    });
  });

  it("forwards only present patch fields so an empty body reaches the domain no-op path", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    updateReviewMock.mockResolvedValue({ ok: true, data: sampleView });

    const empty = await updateReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3" }));
    expect(empty.ok).toBe(true);
    expect(updateReviewMock).toHaveBeenCalledWith(42, 11, {});

    updateReviewMock.mockClear();
    updateReviewMock.mockResolvedValue({ ok: true, data: { ...sampleView, content: "Partial only" } });

    const partial = await updateReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3", content: "Partial only" }));
    expect(partial.ok).toBe(true);
    expect(updateReviewMock).toHaveBeenCalledWith(42, 11, { content: "Partial only" });
  });
});

describe("deleteReviewAction", () => {
  it("returns unauthorized without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const state = await deleteReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3" }));

    expect(state.error).toBe("You must be signed in to manage reviews.");
    expect(deleteReviewMock).not.toHaveBeenCalled();
  });

  it("passes session userId, ignores form reviewerId, and revalidates detail path", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    deleteReviewMock.mockResolvedValue({ ok: true, data: { id: 11 } });

    const state = await deleteReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3", reviewerId: "999" }));

    expect(state).toEqual({ ok: true, error: null, fieldErrors: {} });
    expect(deleteReviewMock).toHaveBeenCalledWith(42, 11);
    expect(revalidatePathMock).toHaveBeenCalledWith("/restaurants/3");
  });

  it("maps not-found failures without revalidation", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
    deleteReviewMock.mockResolvedValue({ ok: false, error: "not-found" });

    const state = await deleteReviewAction(initialReviewActionState, form({ id: "11", restaurantId: "3" }));

    expect(state).toEqual({
      ok: false,
      error: "Review not found.",
      fieldErrors: {},
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
