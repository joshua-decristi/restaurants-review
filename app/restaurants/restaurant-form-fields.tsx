"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RestaurantFormDefaults {
  title?: string;
  description?: string;
  cuisine?: string;
  street?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
}

interface RestaurantFormFieldsProps {
  defaults?: RestaurantFormDefaults;
  /** Keys are flat form names; actions normalize dotted domain paths once. */
  fieldErrors?: Record<string, string>;
  /** When true, image is required (create). When false, image is optional replacement. */
  imageRequired: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Shared multipart fields for Create and Edit dialogs. */
export function RestaurantFormFields({ defaults = {}, fieldErrors = {}, imageRequired }: RestaurantFormFieldsProps) {
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={defaults.title} required aria-invalid={Boolean(fieldErrors.title)} />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaults.description} required rows={3} aria-invalid={Boolean(fieldErrors.description)} />
        <FieldError message={fieldErrors.description} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cuisine">Cuisine</Label>
        <Input id="cuisine" name="cuisine" defaultValue={defaults.cuisine} required aria-invalid={Boolean(fieldErrors.cuisine)} />
        <FieldError message={fieldErrors.cuisine} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Address</legend>
        <div className="space-y-1.5">
          <Label htmlFor="street">Street</Label>
          <Input id="street" name="street" defaultValue={defaults.street} required aria-invalid={Boolean(fieldErrors.street)} />
          <FieldError message={fieldErrors.street} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={defaults.city} required aria-invalid={Boolean(fieldErrors.city)} />
            <FieldError message={fieldErrors.city} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stateRegion">State / Region</Label>
            <Input id="stateRegion" name="stateRegion" defaultValue={defaults.stateRegion} required aria-invalid={Boolean(fieldErrors.stateRegion)} />
            <FieldError message={fieldErrors.stateRegion} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" name="postalCode" defaultValue={defaults.postalCode} required aria-invalid={Boolean(fieldErrors.postalCode)} />
            <FieldError message={fieldErrors.postalCode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" defaultValue={defaults.country} required aria-invalid={Boolean(fieldErrors.country)} />
            <FieldError message={fieldErrors.country} />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="image">{imageRequired ? "Image" : "Replacement image (optional)"}</Label>
        <Input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={imageRequired}
          aria-invalid={Boolean(fieldErrors.image)}
        />
        <FieldError message={fieldErrors.image} />
      </div>
    </div>
  );
}
