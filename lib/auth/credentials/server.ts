import { eq } from "drizzle-orm";
import { z } from "zod";

import type { User } from "@/domains/users/server";
import { users } from "@/domains/users/server";
import { db } from "@/lib/db/server";
import { getServerLogger } from "@/lib/logging/server";

import { AuthUser } from "../internal/session";
import { verifyPassword } from "../password/server";

const Logger = getServerLogger();

export type Credentials = z.infer<typeof credentialsSchema>;

const CREDENTIALS = {
  email: { label: "Email" },
  password: { label: "Password", type: "password" },
};

/**
 * Credential policy owned by this domain: validate the input, look up the
 * user, verify the password, and derive the trusted role. Returning null
 * fails authentication.
 */
async function authorizeWithCredentials(rawInput: unknown): Promise<AuthUser | null> {
  const { data: credentials } = credentialsSchema.safeParse(rawInput);
  if (!credentials) return null;

  const user = await getUserByEmail(credentials.email);
  if (!user) {
    Logger.warn("No user found with email", { email: credentials.email });
    return null;
  }

  const isValid = await verifyPassword(credentials.password, user.passwordHash);
  if (!isValid) {
    Logger.warn("Failed to hash password", { userId: user.id });
    return null;
  }

  Logger.info("User authenticated", { userId: user.id });
  return {
    id: String(user.id),
    email: user.email,
    role: user.role,
  };
}

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

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return user;
}

export const credentialsProvider = {
  credentials: CREDENTIALS,
  authorize: authorizeWithCredentials,
} as const;
