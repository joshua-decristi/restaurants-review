import { z } from "zod";

/** Stable field issue for form rendering. */
export interface FieldIssue {
  path: string;
  message: string;
}

export type ReviewError = "validation" | "not-found" | "not-owner" | "not-reviewer" | "already-reviewed";

export type ReviewResult<T> = { ok: true; data: T } | { ok: false; error: ReviewError; issues?: FieldIssue[] };

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

/** Detail-page review list direction; default highest. */
export type ReviewSort = "highest" | "lowest";

const ratingSchema = z.number().int().min(1).max(5) as z.ZodType<ReviewRating>;
const contentSchema = z.string().trim().min(1).max(2000);

export const createReviewInputSchema = z.object({
  rating: ratingSchema,
  content: contentSchema,
});

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

/** PATCH schema: every field optional; empty object is an authorized no-op. */
export const updateReviewInputSchema = createReviewInputSchema.partial();

export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

/**
 * Public review projection. `reviewerId` is presentation-only (locate the
 * current user's review); never use it for authorization. No email/role.
 */
export interface ReviewView {
  id: number;
  restaurantId: number;
  reviewerId: number;
  reviewerName: string;
  rating: ReviewRating;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingSummary {
  averageRating: number | null;
  reviewCount: number;
}

/** Unsupported values default to highest. */
export function resolveReviewSort(sort: unknown): ReviewSort {
  return sort === "lowest" ? "lowest" : "highest";
}

/** Maps Zod issues to stable form field paths. */
export function issuesFromZod(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
  }));
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; issues: FieldIssue[] } {
  const { data, error } = schema.safeParse(input);

  if (error) return { ok: false, issues: issuesFromZod(error) };
  return { ok: true, data };
}

export const parseCreateInput = (input: unknown) => parseInput(createReviewInputSchema, input);
export const parseUpdateInput = (input: unknown) => parseInput(updateReviewInputSchema, input);
