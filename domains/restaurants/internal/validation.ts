import { z } from "zod";

/** Stable field issue for form rendering; path uses dot-notation for nested address. */
export interface FieldIssue {
  path: string;
  message: string;
}

export type RestaurantError = "not-owner" | "not-found" | "validation";

export type RestaurantResult<T> = { ok: true; data: T } | { ok: false; error: RestaurantError; issues?: FieldIssue[] };

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Cuisine: trim, collapse repeated whitespace, then enforce length. */
const cuisineSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(60));

export const addressInputSchema = z.object({
  street: trimmed(100),
  city: trimmed(100),
  stateRegion: trimmed(100),
  postalCode: trimmed(20),
  country: trimmed(100),
});

export const createRestaurantInputSchema = z.object({
  title: trimmed(120),
  description: trimmed(2000),
  cuisine: cuisineSchema,
  address: addressInputSchema,
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantInputSchema>;

/** PATCH schema derived from create: every field optional, nested address partial. */
export const updateRestaurantInputSchema = createRestaurantInputSchema.partial().extend({
  address: addressInputSchema.partial().optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantInputSchema>;

export interface RestaurantAddressView {
  street: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
}

/**
 * Public restaurant view. Includes ownerId for presentation-only Edit controls.
 * Never includes imageKey.
 */
export interface RestaurantView {
  id: number;
  ownerId: number;
  title: string;
  description: string;
  cuisine: string;
  imageUrl: string;
  address: RestaurantAddressView;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Maps Zod issues to stable form field paths. */
export function issuesFromZod(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
  }));
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; issues: FieldIssue[] } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: issuesFromZod(parsed.error) };
  return { ok: true, data: parsed.data };
}

export const parseCreateInput = (input: unknown) => parseInput(createRestaurantInputSchema, input);
export const parseUpdateInput = (input: unknown) => parseInput(updateRestaurantInputSchema, input);

/** Validate a single image File before any upload. */
export function validateImage(file: File | undefined, { required }: { required: boolean }): FieldIssue[] {
  if (file === undefined) return required ? [{ path: "image", message: "An image is required." }] : [];
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return [{ path: "image", message: "Image must be JPEG, PNG, or WebP." }];
  if (file.size > MAX_IMAGE_BYTES) return [{ path: "image", message: "Image must be at most 5 MB." }];
  if (file.size <= 0) return [{ path: "image", message: "Image file is empty." }];
  return [];
}

/** True when the PATCH carries at least one field or a replacement image. */
export function hasUpdateContent(patch: UpdateRestaurantInput, replacement?: File): boolean {
  if (replacement) return true;
  if (patch.title !== undefined || patch.description !== undefined || patch.cuisine !== undefined) return true;
  if (patch.address === undefined) return false;
  return Object.keys(definedEntries(patch.address)).length > 0;
}

/** Drop undefined keys so Drizzle `.set` never receives an empty/partial-undefined object. */
export function definedEntries<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}
