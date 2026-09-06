"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ReviewForm } from "./review-form";

/** Reviewer-only Create dialog for a restaurant the user has not yet reviewed. */
export function CreateReviewDialog({ restaurantId }: { restaurantId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Write a review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>Share a rating and your experience. One review per restaurant.</DialogDescription>
        </DialogHeader>
        <ReviewForm
          mode="create"
          restaurantId={restaurantId}
          onSuccess={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
