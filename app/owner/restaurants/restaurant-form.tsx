"use client";

import { useActionState, useEffect, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

import { createRestaurantAction, type RestaurantActionState, updateRestaurantAction } from "./restaurant-actions";
import { RestaurantFormFields } from "./restaurant-form-fields";
import type { RestaurantFormValues } from "./restaurant-form-schema";
import { applyServerFieldErrors, createRestaurantFormSchema, editRestaurantFormSchema, toRestaurantFormData } from "./restaurant-form-schema";

/** Client-local seed — cannot import values from the "use server" actions module. */
const initialState: RestaurantActionState = { ok: false, error: null, fieldErrors: {} };

interface RestaurantFormProps {
  mode: "create" | "edit";
  defaultValues: RestaurantFormValues;
  /** Edit only — flattened into FormData `id`. */
  restaurantId?: number;
  onSuccess: () => void;
}

/** Shared RHF + server-action form used by Create and Edit dialogs. */
export function RestaurantForm({ mode, defaultValues, restaurantId, onSuccess }: RestaurantFormProps) {
  const action = mode === "create" ? createRestaurantAction : updateRestaurantAction;
  const schema = mode === "create" ? createRestaurantFormSchema : editRestaurantFormSchema;
  const imageRequired = mode === "create";
  const submitLabel = mode === "create" ? "Create" : "Save";
  const pendingLabel = mode === "create" ? "Creating…" : "Saving…";

  const [state, formAction, actionPending] = useActionState(action, initialState);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RestaurantFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  useEffect(() => {
    if (!state.ok && Object.keys(state.fieldErrors).length > 0) applyServerFieldErrors(setError, state.fieldErrors);
  }, [state, setError]);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          startTransition(() => {
            formAction(toRestaurantFormData(values, restaurantId));
          });
        })(event);
      }}
    >
      <RestaurantFormFields register={register} errors={errors} imageRequired={imageRequired} disabled={pending} />
      {!!state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
