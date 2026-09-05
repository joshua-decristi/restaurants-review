"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { createReviewAction, type ReviewActionState } from "./review-actions";
import { ReviewFormFields } from "./review-form-fields";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: ReviewActionState = { ok: false, error: null, fieldErrors: {} };

function CreateReviewForm({ restaurantId, onSuccess }: { restaurantId: number; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createReviewAction, initialState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <ReviewFormFields fieldErrors={state.fieldErrors} />
      {!!state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit review"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Reviewer-only Create dialog for a restaurant the user has not yet reviewed. */
export function CreateReviewDialog({ restaurantId }: { restaurantId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Write a review</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>Share a rating and your experience. One review per restaurant.</DialogDescription>
        </DialogHeader>
        {open && (
          <CreateReviewForm
            restaurantId={restaurantId}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
