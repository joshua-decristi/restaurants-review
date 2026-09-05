"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { type RestaurantActionState, updateRestaurantAction } from "./restaurant-actions";
import { type RestaurantFormDefaults, RestaurantFormFields } from "./restaurant-form-fields";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: RestaurantActionState = { ok: false, error: null, fieldErrors: {} };

interface EditRestaurantDialogProps {
  restaurantId: number;
  defaults: RestaurantFormDefaults;
}

function EditRestaurantForm({ restaurantId, defaults, onSuccess }: EditRestaurantDialogProps & { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(updateRestaurantAction, initialState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={restaurantId} />
      <RestaurantFormFields defaults={defaults} fieldErrors={state.fieldErrors} imageRequired={false} />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Owner-only Edit dialog for restaurants the current user owns. */
export function EditRestaurantDialog({ restaurantId, defaults }: EditRestaurantDialogProps) {
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
          <DialogTitle>Edit restaurant</DialogTitle>
          <DialogDescription>Update fields or optionally replace the image.</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditRestaurantForm
            restaurantId={restaurantId}
            defaults={defaults}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
