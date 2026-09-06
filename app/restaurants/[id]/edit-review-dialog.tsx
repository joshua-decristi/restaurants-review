"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ReviewForm, type ReviewFormDefaults } from "./review-form";

interface EditReviewDialogProps {
  reviewId: number;
  restaurantId: number;
  defaults: ReviewFormDefaults;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit review</DialogTitle>
          <DialogDescription>Update your rating or comments.</DialogDescription>
        </DialogHeader>
        <ReviewForm
          mode="edit"
          restaurantId={restaurantId}
          reviewId={reviewId}
          defaultValues={defaults}
          onSuccess={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
