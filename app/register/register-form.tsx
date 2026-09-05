"use client";

import { useActionState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type RegisterUserInput, registerUserInputSchema } from "@/domains/users";
import { cn } from "@/lib/utils";

import { registerAction, type RegisterActionState } from "./register-action";

const initialState: RegisterActionState = { ok: false, error: null, fieldErrors: {} };

const ROLES = [
  { value: "reviewer" as const, title: "Reviewer", description: "Discover restaurants and share reviews." },
  { value: "owner" as const, title: "Owner", description: "Manage your restaurants." },
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function RegisterForm() {
  const [state, formAction, actionPending] = useActionState(registerAction, initialState);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterUserInput>({
    resolver: zodResolver(registerUserInputSchema),
    // No role default — user must pick reviewer | owner explicitly.
    defaultValues: { name: "", email: "", password: "" },
  });

  // Prefer live RHF messages; fall back to last server fieldErrors.
  const msg = (name: keyof RegisterUserInput) => errors[name]?.message ?? state.fieldErrors[name];

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          const fd = new FormData();
          for (const [key, value] of Object.entries(values)) fd.set(key, value);
          startTransition(() => {
            formAction(fd);
          });
        })(event);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" autoComplete="name" aria-invalid={Boolean(msg("name"))} disabled={pending} {...register("name")} />
        <p className="text-xs text-muted-foreground">Appears with your reviews.</p>
        <FieldError message={msg("name")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(msg("email"))} disabled={pending} {...register("email")} />
        <FieldError message={msg("email")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(msg("password"))} disabled={pending} {...register("password")} />
        <FieldError message={msg("password")} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Role</legend>
        <p className="text-xs text-muted-foreground">The selected role cannot be changed later.</p>
        <div className="grid gap-2">
          {ROLES.map((role) => (
            <label
              key={role.value}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50",
                "has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-2 has-[:checked]:ring-primary/20",
                msg("role") && "border-destructive/60",
                pending && "pointer-events-none opacity-50",
              )}
            >
              <input type="radio" value={role.value} className="sr-only" disabled={pending} {...register("role")} />
              <span className="text-sm font-medium">{role.title}</span>
              <span className="text-xs text-muted-foreground">{role.description}</span>
            </label>
          ))}
        </div>
        <FieldError message={msg("role")} />
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
