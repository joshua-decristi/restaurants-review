"use server";

import { revalidatePath } from "next/cache";

import { createRestaurant, deleteRestaurant, type FieldIssue, updateRestaurant } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";

/** Stable form-state contract for Create/Edit/Delete dialogs. */
export interface RestaurantActionState {
  ok: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "You must be signed in to manage restaurants.",
  "not-owner": "Only restaurant owners can perform this action.",
  "not-found": "Restaurant not found.",
  validation: "Please fix the highlighted fields and try again.",
};

/** Form fields are strings; non-string entries are treated as empty. */
function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formFile(formData: FormData, key: string): File | undefined {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : undefined;
}

/**
 * Full restaurant + address payload shared by Create and the current full Edit UI.
 * Always forwards raw submitted strings (including blanks) so domain validation
 * can reject supplied blank fields.
 */
function parseRestaurantFields(formData: FormData) {
  return {
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    cuisine: formString(formData, "cuisine"),
    address: {
      street: formString(formData, "street"),
      city: formString(formData, "city"),
      stateRegion: formString(formData, "stateRegion"),
      postalCode: formString(formData, "postalCode"),
      country: formString(formData, "country"),
    },
  };
}

async function authenticate(): Promise<{ ok: true; userId: number } | { ok: false; state: RestaurantActionState }> {
  // Session is authoritative; never trust owner IDs from form fields.
  const session = await getSession();
  const userId = Number(session?.user.id);
  if (!session || !Number.isSafeInteger(userId)) return { ok: false, state: { ok: false, error: ERROR_MESSAGES.unauthorized, fieldErrors: {} } };
  return { ok: true, userId };
}

/** Map domain issue paths onto flat form field names once (address.* → *). */
function toFormPath(path: string): string {
  return path.startsWith("address.") ? path.slice("address.".length) : path;
}

function mapIssues(issues: FieldIssue[] | undefined): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues ?? []) {
    const path = toFormPath(issue.path);
    if (!Object.hasOwn(fieldErrors, path)) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

function mapFailure(error: string, issues?: FieldIssue[]): RestaurantActionState {
  return {
    ok: false,
    error: ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.",
    fieldErrors: mapIssues(issues),
  };
}

function revalidateRestaurantLists(): void {
  revalidatePath("/owner/restaurants");
  revalidatePath("/restaurants");
}

/**
 * Multipart create adapter: authenticates, ignores any form owner fields,
 * delegates to the domain, and maps discriminated results to form state.
 */
export async function createRestaurantAction(_state: RestaurantActionState, formData: FormData): Promise<RestaurantActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  // Domain validates image contents; transport only ensures a File is present
  // because createRestaurant's public signature requires one.
  const image = formFile(formData, "image");
  if (!image) return mapFailure("validation", [{ path: "image", message: "An image is required." }]);

  // Intentionally ignore any client-supplied ownerId / userId fields.
  const result = await createRestaurant(auth.userId, parseRestaurantFields(formData), image);
  if (!result.ok) return mapFailure(result.error, result.issues);

  revalidateRestaurantLists();
  return { ok: true, error: null, fieldErrors: {} };
}

/**
 * Multipart update adapter: authenticates, derives restaurant id from the form
 * id field only (never ownership from the client), and maps domain results.
 * Full-form Edit reuses the same field parsing as Create so blanks stay blanks.
 */
export async function updateRestaurantAction(_state: RestaurantActionState, formData: FormData): Promise<RestaurantActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  const id = Number(formString(formData, "id"));
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: ERROR_MESSAGES["not-found"], fieldErrors: {} };

  const result = await updateRestaurant(auth.userId, id, parseRestaurantFields(formData), formFile(formData, "image"));

  if (!result.ok) return mapFailure(result.error, result.issues);

  revalidateRestaurantLists();
  return { ok: true, error: null, fieldErrors: {} };
}

/** Delete adapter: session owner only; id from form; dual list revalidation. */
export async function deleteRestaurantAction(_state: RestaurantActionState, formData: FormData): Promise<RestaurantActionState> {
  const auth = await authenticate();
  if (!auth.ok) return auth.state;

  const id = Number(formString(formData, "id"));
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: ERROR_MESSAGES["not-found"], fieldErrors: {} };

  const result = await deleteRestaurant(auth.userId, id);
  if (!result.ok) return mapFailure(result.error);

  revalidateRestaurantLists();
  return { ok: true, error: null, fieldErrors: {} };
}
