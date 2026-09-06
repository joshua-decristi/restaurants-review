"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type Resolver, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { type CreateReviewInput, createReviewInputSchema } from "@/domains/reviews";

import { createReviewAction, type ReviewActionState, updateReviewAction } from "./review-actions";
import { ReviewFormFields } from "./review-form-fields";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: ReviewActionState = { ok: false, error: null, fieldErrors: {} };

export type ReviewFormDefaults = CreateReviewInput;

export const emptyReviewFormValues: CreateReviewInput = { rating: 5, content: "" };

interface ReviewFormProps {
  mode: "create" | "edit";
  restaurantId: number;
  /** Edit only — flattened into FormData `id`. */
  reviewId?: number;
  defaultValues?: ReviewFormDefaults;
  onSuccess: () => void;
}

function toFormData(mode: "create" | "edit", restaurantId: number, values: CreateReviewInput, reviewId?: number): FormData {
  const fd = new FormData();
  if (mode === "edit" && reviewId !== undefined) fd.set("id", String(reviewId));
  fd.set("restaurantId", String(restaurantId));
  fd.set("rating", String(values.rating));
  fd.set("content", values.content);
  return fd;
}

/** Shared RHF + direct-awaited server-action form used by Create and Edit dialogs. */
export function ReviewForm({ mode, restaurantId, reviewId, defaultValues = emptyReviewFormValues, onSuccess }: ReviewFormProps) {
  const action = mode === "create" ? createReviewAction : updateReviewAction;
  const submitLabel = mode === "create" ? "Submit review" : "Save";
  const pendingLabel = mode === "create" ? "Submitting…" : "Saving…";

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CreateReviewInput>({
    // ZodType cast on rating makes resolver input `unknown`; assert to CreateReviewInput.
    resolver: zodResolver(createReviewInputSchema) as Resolver<CreateReviewInput>,
    mode: "onChange",
    defaultValues,
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors();

    try {
      const result = await action(initialState, toFormData(mode, restaurantId, values, reviewId));

      if (result.ok) {
        onSuccess();
        return;
      }

      for (const [key, message] of Object.entries(result.fieldErrors)) {
        if (key === "rating" || key === "content") {
          setError(key, { type: "server", message });
        }
      }

      if (result.error) {
        setError("root.server", { message: result.error });
      }
    } catch {
      setError("root.server", { message: "Unable to save your review. Please try again." });
    }
  });

  const serverError = errors.root?.server.message;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <ReviewFormFields register={register} errors={errors} disabled={isSubmitting} />
      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
