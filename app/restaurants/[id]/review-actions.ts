"use server";

import { revalidatePath } from "next/cache";

import { createReview, deleteReview, type FieldIssue, type ReviewRating, updateReview, type UpdateReviewInput } from "@/domains/reviews/server";
import { getSession } from "@/lib/auth/server";

/** Stable form-state contract for Create/Edit/Delete review controls. */
export interface ReviewActionState {
  ok: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "You must be signed in to manage reviews.",
  "not-reviewer": "Only reviewers can perform this action.",
  "not-owner": "You can only modify your own review.",
  "not-found": "Review not found.",
  "already-reviewed": "You have already reviewed this restaurant.",
  validation: "Please fix the highlighted fields and try again.",
};

/** Form fields are strings; non-string entries are treated as empty. */
function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parsePositiveInt(raw: string): number | null {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Rating arrives as a string from the form. Coerce to number and cast to the
 * public rating union; domain validation still rejects out-of-range values.
 */
function parseRating(formData: FormData): ReviewRating {
  return Number(formString(formData, "rating")) as ReviewRating;
}

async function authenticate(): Promise<{ ok: true; userId: number } | { ok: false; state: ReviewActionState }> {
  // Session is authoritative; never trust reviewer IDs from form fields.
  const session = await getSession();
  const userId = Number(session?.user.id);
  if (!session || !Number.isSafeInteger(userId)) {
    return { ok: false, state: { ok: false, error: ERROR_MESSAGES.unauthorized, fieldErrors: {} } };
  }

  return { ok: true, userId };
}

function mapIssues(issues: FieldIssue[] | undefined): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues ?? []) {
    if (!Object.hasOwn(fieldErrors, issue.path)) fieldErrors[issue.path] = issue.message;
  }

  return fieldErrors;
}

function mapFailure(error: string, issues?: FieldIssue[]): ReviewActionState {
  return {
    ok: false,
    error: ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.",
    fieldErrors: mapIssues(issues),
  };
}

function revalidateRestaurantPaths(restaurantId: number): void {
  revalidatePath(`/restaurants/${String(restaurantId)}`);
  revalidatePath("/restaurants");
}

/**
 * Create adapter: authenticates, ignores any form reviewerId, delegates to the
 * domain, and maps discriminated results to form state.
 */
export async function createReviewAction(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  const restaurantId = parsePositiveInt(formString(formData, "restaurantId"));
  if (restaurantId === null) return mapFailure("not-found");

  // Intentionally ignore any client-supplied reviewerId / userId fields.
  const result = await createReview(auth.userId, restaurantId, {
    rating: parseRating(formData),
    content: formString(formData, "content"),
  });

  if (!result.ok) return mapFailure(result.error, result.issues);

  revalidateRestaurantPaths(restaurantId);
  return { ok: true, error: null, fieldErrors: {} };
}

/**
 * PATCH body from form keys that are actually present. Missing keys are omitted
 * so the domain can treat `{}` as an authorized no-op; present blank strings stay.
 * The Edit modal still posts both rating and content on normal submits.
 */
function parseUpdateFields(formData: FormData): UpdateReviewInput {
  const input: UpdateReviewInput = {};
  if (formData.has("rating")) input.rating = parseRating(formData);
  if (formData.has("content")) input.content = formString(formData, "content");

  return input;
}

/**
 * Update adapter: authenticates, derives review id from the form id field only,
 * forwards only present patch fields, and maps domain results.
 */
export async function updateReviewAction(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  const reviewId = parsePositiveInt(formString(formData, "id"));
  if (reviewId === null) return mapFailure("not-found");

  const restaurantId = parsePositiveInt(formString(formData, "restaurantId"));
  const result = await updateReview(auth.userId, reviewId, parseUpdateFields(formData));

  if (!result.ok) return mapFailure(result.error, result.issues);

  // Prefer the form restaurantId for path refresh; fall back to the returned view.
  revalidateRestaurantPaths(restaurantId ?? result.data.restaurantId);
  return { ok: true, error: null, fieldErrors: {} };
}

/**
 * Delete adapter: authenticates, derives review id from the form, and refreshes
 * detail + list paths after a successful hard delete.
 */
export async function deleteReviewAction(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  const reviewId = parsePositiveInt(formString(formData, "id"));
  if (reviewId === null) return mapFailure("not-found");

  const restaurantId = parsePositiveInt(formString(formData, "restaurantId"));
  const result = await deleteReview(auth.userId, reviewId);

  if (!result.ok) return mapFailure(result.error, result.issues);
  if (restaurantId !== null) revalidateRestaurantPaths(restaurantId);

  return { ok: true, error: null, fieldErrors: {} };
}
