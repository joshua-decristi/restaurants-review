import "server-only";

import { redirect } from "next/navigation";

import { serverEnv } from "@/lib/env/server";

import { createAuth, InvalidCredentialsError } from "./auth/server";
import { credentialsSchema } from "./credentials";
import { verifyPassword } from "./password";
import { getUserByEmail } from "./queries";

/**
 * Public server interface of the users domain: authentication operations and
 * the current-session mapping, with all Auth.js specifics hidden behind the
 * private auth sub-module.
 */

export interface CurrentUser {
  id: number;
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
  redirectTo: string;
}

export type LoginResult = { ok: true } | { ok: false; error: "invalid-credentials" };

const { authRouteHandlers, signInCredentials, signOutSession, getSession } = createAuth({
  secret: serverEnv.AUTH_SECRET,
  verifyCredentials: async (raw) => {
    const credentials = credentialsSchema.safeParse(raw);
    if (!credentials.success) return null;

    const user = await getUserByEmail(credentials.data.email);
    if (!user) return null;

    const isValid = await verifyPassword(credentials.data.password, user.passwordHash);
    return isValid ? { id: String(user.id), email: user.email } : null;
  },
});

/**
 * Credentials sign-in. A successful sign-in completes via a framework
 * redirect that must propagate to the caller; failures return a single
 * opaque error so email existence is never leaked.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    await signInCredentials(input);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return { ok: false, error: "invalid-credentials" };

    throw error;
  }
  return { ok: true };
}

/** Signs the user out; completes via a framework redirect. */
export async function logout(redirectTo = "/"): Promise<void> {
  await signOutSession(redirectTo);
}

/** Maps the current session to a domain user, or null when signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const id = Number(session.user.id);
  return Number.isInteger(id) ? { id, email: session.user.email } : null;
}

/** Requires a signed-in user, redirecting to the login page otherwise. */
export async function requireUser(loginRedirect = "/login"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirect);
  return user;
}

export { authRouteHandlers };
