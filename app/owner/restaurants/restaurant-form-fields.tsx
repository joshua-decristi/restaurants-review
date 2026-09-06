"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { RestaurantFormValues } from "./restaurant-form-schema";

interface RestaurantFormFieldsProps {
  register: UseFormRegister<RestaurantFormValues>;
  errors: FieldErrors<RestaurantFormValues>;
  /** When true, image is required (create). When false, image is optional replacement. */
  imageRequired: boolean;
  disabled?: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Shared RHF fields for Create and Edit dialogs (nested address paths). */
export function RestaurantFormFields({ register, errors, imageRequired, disabled }: RestaurantFormFieldsProps) {
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" aria-invalid={Boolean(errors.title)} disabled={disabled} {...register("title")} />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} aria-invalid={Boolean(errors.description)} disabled={disabled} {...register("description")} />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cuisine">Cuisine</Label>
        <Input id="cuisine" aria-invalid={Boolean(errors.cuisine)} disabled={disabled} {...register("cuisine")} />
        <FieldError message={errors.cuisine?.message} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Address</legend>
        <div className="space-y-1.5">
          <Label htmlFor="street">Street</Label>
          <Input id="street" aria-invalid={Boolean(errors.address?.street)} disabled={disabled} {...register("address.street")} />
          <FieldError message={errors.address?.street?.message} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" aria-invalid={Boolean(errors.address?.city)} disabled={disabled} {...register("address.city")} />
            <FieldError message={errors.address?.city?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stateRegion">State / Region</Label>
            <Input id="stateRegion" aria-invalid={Boolean(errors.address?.stateRegion)} disabled={disabled} {...register("address.stateRegion")} />
            <FieldError message={errors.address?.stateRegion?.message} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" aria-invalid={Boolean(errors.address?.postalCode)} disabled={disabled} {...register("address.postalCode")} />
            <FieldError message={errors.address?.postalCode?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" aria-invalid={Boolean(errors.address?.country)} disabled={disabled} {...register("address.country")} />
            <FieldError message={errors.address?.country?.message} />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="image">{imageRequired ? "Image" : "Replacement image (optional)"}</Label>
        <Input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(errors.image)}
          disabled={disabled}
          {...register("image")}
        />
        <FieldError message={errors.image?.message} />
      </div>
    </div>
  );
}
