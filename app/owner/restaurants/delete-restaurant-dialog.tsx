"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { deleteRestaurantAction, type RestaurantActionState } from "./restaurant-actions";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: RestaurantActionState = { ok: false, error: null, fieldErrors: {} };

interface DeleteRestaurantDialogProps {
  restaurantId: number;
  restaurantTitle: string;
}

function DeleteRestaurantForm({
  restaurantId,
  restaurantTitle,
  onSuccess,
  onCancel,
}: DeleteRestaurantDialogProps & { onSuccess: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(deleteRestaurantAction, initialState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={restaurantId} />
      <DialogHeader>
        <DialogTitle>Delete “{restaurantTitle}”?</DialogTitle>
        <DialogDescription>This permanently deletes the restaurant. This cannot be undone.</DialogDescription>
      </DialogHeader>
      {!!state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Named destructive confirm — title in the dialog; confirm click only. */
export function DeleteRestaurantDialog({ restaurantId, restaurantTitle }: DeleteRestaurantDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        {open ? (
          <DeleteRestaurantForm
            restaurantId={restaurantId}
            restaurantTitle={restaurantTitle}
            onSuccess={() => {
              setOpen(false);
            }}
            onCancel={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
