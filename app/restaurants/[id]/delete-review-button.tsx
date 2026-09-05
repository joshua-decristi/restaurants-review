"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { deleteReviewAction, type ReviewActionState } from "./review-actions";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: ReviewActionState = { ok: false, error: null, fieldErrors: {} };

interface DeleteReviewButtonProps {
  reviewId: number;
  restaurantId: number;
}

/** Author-only hard-delete control; errors surface inline beside the button. */
export function DeleteReviewButton({ reviewId, restaurantId }: DeleteReviewButtonProps) {
  const [state, formAction, pending] = useActionState(deleteReviewAction, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={reviewId} />
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {!!state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
