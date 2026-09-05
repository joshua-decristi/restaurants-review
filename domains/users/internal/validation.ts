import { z } from "zod";

import { roleSchema } from "./roles";

/**
 * Public display name: trimmed, 1–100 characters.
 * Used for review attribution; never derived from email.
 */
export const userNameSchema = z.string().trim().min(1).max(100);

export type UserName = z.infer<typeof userNameSchema>;

/** Same normalization as lib/auth/credentials `normalizeEmail`. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Shared client/server registration input. Pure — no db/hash/server-only. */
export const registerUserInputSchema = z.object({
  name: userNameSchema,
  email: z.string().transform(normalizeEmail).pipe(z.email()),
  password: z.string().min(8),
  role: roleSchema,
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;
