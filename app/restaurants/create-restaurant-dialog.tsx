"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { createRestaurantAction, type RestaurantActionState } from "./restaurant-actions";
import { RestaurantFormFields } from "./restaurant-form-fields";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: RestaurantActionState = { ok: false, error: null, fieldErrors: {} };

function CreateRestaurantForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createRestaurantAction, initialState);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <RestaurantFormFields fieldErrors={state.fieldErrors} imageRequired />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Owner-only Create dialog that posts multipart FormData to a Server Action. */
export function CreateRestaurantDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Create restaurant</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create restaurant</DialogTitle>
          <DialogDescription>Add a restaurant you own. An image is required.</DialogDescription>
        </DialogHeader>
        {open ? (
          <CreateRestaurantForm
            onSuccess={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
