"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ReviewFormDefaults {
  rating?: number;
  content?: string;
}

interface ReviewFormFieldsProps {
  defaults?: ReviewFormDefaults;
  /** Keys are form field names (`rating`, `content`). */
  fieldErrors?: Record<string, string>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Shared fields for Create and Edit review dialogs. */
export function ReviewFormFields({ defaults = {}, fieldErrors = {} }: ReviewFormFieldsProps) {
  const defaultRating = defaults.rating !== undefined && (RATINGS as readonly number[]).includes(defaults.rating) ? String(defaults.rating) : "5";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="rating">Rating</Label>
        <select
          id="rating"
          name="rating"
          defaultValue={defaultRating}
          required
          aria-invalid={Boolean(fieldErrors.rating)}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          {RATINGS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.rating} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">Review</Label>
        <Textarea id="content" name="content" defaultValue={defaults.content} required rows={4} maxLength={2000} aria-invalid={Boolean(fieldErrors.content)} />
        <FieldError message={fieldErrors.content} />
      </div>
    </div>
  );
}
