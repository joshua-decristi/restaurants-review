"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { RestaurantForm } from "./restaurant-form";
import type { RestaurantFormDefaults } from "./restaurant-form-schema";

interface EditRestaurantDialogProps {
  restaurantId: number;
  defaults: RestaurantFormDefaults;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit restaurant</DialogTitle>
          <DialogDescription>Update fields or optionally replace the image.</DialogDescription>
        </DialogHeader>
        {open && (
          <RestaurantForm
            mode="edit"
            defaultValues={defaults}
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
