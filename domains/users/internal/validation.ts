import { z } from "zod";

/**
 * Public display name: trimmed, 1–100 characters.
 * Used for review attribution; never derived from email.
 */
export const userNameSchema = z.string().trim().min(1).max(100);

export type UserName = z.infer<typeof userNameSchema>;
