import { z } from "zod";

/**
 * The only two roles the application supports. A user's role is immutable —
 * there is no role-change API — so a persisted or token-carried role stays
 * trusted for the session's lifetime.
 */
export const ROLES = ["reviewer", "owner"] as const;

/** Stable role type shared across the users domain (persistence, sessions). */
export type Role = (typeof ROLES)[number];

/** Runtime validation for role values from untrusted sources such as JWT claims. */
export const roleSchema = z.enum(ROLES);

/** Type guard narrowing an unknown value (e.g. a JWT claim) to `Role`. */
export function isRole(value: unknown): value is Role {
  return roleSchema.safeParse(value).success;
}
