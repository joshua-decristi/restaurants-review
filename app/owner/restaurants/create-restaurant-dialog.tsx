"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { RestaurantForm } from "./restaurant-form";
import { emptyRestaurantFormValues } from "./restaurant-form-schema";

/** Owner-only Create dialog that posts multipart FormData to a Server Action. */
export function CreateRestaurantDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Create restaurant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create restaurant</DialogTitle>
          <DialogDescription>Add a restaurant you own. An image is required.</DialogDescription>
        </DialogHeader>
        {open && (
          <RestaurantForm
            mode="create"
            defaultValues={emptyRestaurantFormValues}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
