import type { UseFormSetError } from "react-hook-form";
import { z } from "zod";

import { createRestaurantInputSchema, validateImage } from "@/domains/restaurants";

function imageFieldSchema(required: boolean) {
  return z
    .custom<FileList | undefined>()
    .optional()
    .superRefine((value, ctx) => {
      const file = value instanceof FileList ? (value.item(0) ?? undefined) : undefined;
      for (const issue of validateImage(file, { required })) {
        ctx.addIssue({ code: "custom", message: issue.message });
      }
    });
}

/** Create: full text/address + required image type/size checks. */
export const createRestaurantFormSchema = createRestaurantInputSchema.extend({
  image: imageFieldSchema(true),
});

/** Edit: full text/address + optional replacement image. */
export const editRestaurantFormSchema = createRestaurantInputSchema.extend({
  image: imageFieldSchema(false),
});

export type RestaurantFormValues = z.infer<typeof createRestaurantFormSchema>;

/** Nested text/address defaults (no image) — matches RHF shape; page passes address as-is. */
export type RestaurantFormDefaults = Pick<RestaurantFormValues, "title" | "description" | "cuisine" | "address">;

export const emptyRestaurantFormValues: RestaurantFormValues = {
  title: "",
  description: "",
  cuisine: "",
  address: { street: "", city: "", stateRegion: "", postalCode: "", country: "" },
};

const FLAT_ADDRESS_KEYS = ["street", "city", "stateRegion", "postalCode", "country"] as const;

/**
 * Explicit FormData keys only — never Object.entries(values) (nested address + FileList).
 * Edit passes restaurantId so the action receives flat `id`.
 */
export function toRestaurantFormData(values: RestaurantFormValues, restaurantId?: number): FormData {
  const fd = new FormData();
  if (restaurantId !== undefined) fd.set("id", String(restaurantId));

  fd.set("title", values.title);
  fd.set("description", values.description);
  fd.set("cuisine", values.cuisine);
  fd.set("street", values.address.street);
  fd.set("city", values.address.city);
  fd.set("stateRegion", values.address.stateRegion);
  fd.set("postalCode", values.address.postalCode);
  fd.set("country", values.address.country);

  const image = values.image instanceof FileList ? values.image.item(0) : undefined;
  if (image) fd.append("image", image);

  return fd;
}

/** Map flat server fieldErrors (street, title, …) onto nested RHF paths. */
export function applyServerFieldErrors(setError: UseFormSetError<RestaurantFormValues>, fieldErrors: Record<string, string>): void {
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (key === "title" || key === "description" || key === "cuisine" || key === "image") {
      setError(key, { type: "server", message });
      continue;
    }

    if ((FLAT_ADDRESS_KEYS as readonly string[]).includes(key)) {
      setError(`address.${key as (typeof FLAT_ADDRESS_KEYS)[number]}`, { type: "server", message });
    }
  }
}
