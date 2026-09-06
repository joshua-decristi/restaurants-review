"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateReviewInput } from "@/domains/reviews";

interface ReviewFormFieldsProps {
  register: UseFormRegister<CreateReviewInput>;
  errors: FieldErrors<CreateReviewInput>;
  disabled?: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Shared RHF fields for Create and Edit review dialogs. */
export function ReviewFormFields({ register, errors, disabled }: ReviewFormFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="rating">Rating</Label>
        <select
          id="rating"
          disabled={disabled}
          aria-invalid={Boolean(errors.rating)}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"
          {...register("rating", { valueAsNumber: true })}
        >
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <FieldError message={errors.rating?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Review</Label>
        <Textarea id="content" rows={4} maxLength={2000} disabled={disabled} aria-invalid={Boolean(errors.content)} {...register("content")} />
        <FieldError message={errors.content?.message} />
      </div>
    </div>
  );
}
