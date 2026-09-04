import { z } from "zod";

/** Domain email normalization: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Credential validation owned by the users domain. Every path that accepts
 * credentials (sign-in, future registration) validates through this schema,
 * so the transport shape never leaks into domain logic.
 */
export const credentialsSchema = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.email()),
  password: z.string().min(8), // In production, I'd make the password stronger by requireing: special chars, numbers, etc
});

export type Credentials = z.infer<typeof credentialsSchema>;
