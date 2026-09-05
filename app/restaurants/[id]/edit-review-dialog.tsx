"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { type ReviewActionState, updateReviewAction } from "./review-actions";
import { type ReviewFormDefaults, ReviewFormFields } from "./review-form-fields";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: ReviewActionState = { ok: false, error: null, fieldErrors: {} };

interface EditReviewDialogProps {
  reviewId: number;
  restaurantId: number;
  defaults: ReviewFormDefaults;
}

function EditReviewForm({ reviewId, restaurantId, defaults, onSuccess }: EditReviewDialogProps & { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(updateReviewAction, initialState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={reviewId} />
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <ReviewFormFields defaults={defaults} fieldErrors={state.fieldErrors} />
      {!!state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Author-only Edit dialog for the current user's review. */
export function EditReviewDialog({ reviewId, restaurantId, defaults }: EditReviewDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit review</DialogTitle>
          <DialogDescription>Update your rating or comments.</DialogDescription>
        </DialogHeader>
        {open && (
          <EditReviewForm
            reviewId={reviewId}
            restaurantId={restaurantId}
            defaults={defaults}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
