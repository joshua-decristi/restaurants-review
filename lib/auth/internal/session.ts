import type { Session } from "next-auth";
import { CredentialsSignin } from "next-auth";
import CredentialProvider from "next-auth/providers/credentials";

import type { Role } from "@/domains/users/server";
import { isRole } from "@/domains/users/server";

import type { Credentials } from "../credentials/server";
import { credentialsProvider } from "../credentials/server";

import { createAuthjsAdapter } from "./auth-js";

/** Stable session-user shape hidden behind the wrapper. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** Display name from sign-in; absent when the JWT has no name claim. */
  name?: string;
}

/**
 * Result of a login attempt. A successful sign-in never produces `{ ok: true }`
 * at runtime — login exits through a role redirect — but the variant stays in
 * the contract so callers can branch on the result.
 */
export type LoginResult = { ok: true } | { ok: false; error: "invalid-credentials" };

const { auth, handlers, signIn, signOut } = createAuthjsAdapter([CredentialProvider(credentialsProvider)]);

/** Returns the single opaque login failure. */
function rejectLogin(): LoginResult {
  return { ok: false, error: "invalid-credentials" };
}

export const POST_SIGNIN_URL = "/";
export const authJsHandlers = handlers;
export const login = {
  /**
   * Credentials sign-in:
   * - successful sign-in return validated user (2nd lookup required to get User record)
   * - Rejected credentials throw `InvalidCredentialsError`.
   */
  credentials: async ({ email, password }: Credentials): Promise<LoginResult> =>
    signIn("credentials", { email, password, redirectTo: POST_SIGNIN_URL })
      .then(() => ({ ok: true }) as const)
      .catch((error: unknown) => {
        if (error instanceof CredentialsSignin) return rejectLogin();
        throw error;
      }),
};

/** Signs the user out; completes via a framework redirect. */
export async function logout(redirectTo = "/"): Promise<void> {
  await signOut({ redirectTo });
}

// Middleware-shaped session reader: given an explicit request (e.g. from
// the proxy), Auth.js validates the session cookie on that request instead
// of relying on framework cookie globals, and this thin wrapper echoes the
// parsed session back as JSON. Auth.js types the wrapper for Next.js
// middleware use; the adapter calls it directly with any `Request`, which
// is all session reading needs.
const sessionMiddleware = auth((request) => Response.json(request.auth)) as unknown as (request: Request) => Promise<Response>;

async function readSession(request: Request): Promise<Session | null> {
  const response = await sessionMiddleware(request);
  if (!response.ok) return null;
  return (await response.json()) as Session | null;
}

/** Maps an Auth.js session to the stable wrapper user shape, or null. */
function mapSession(session: Session | null): { user: AuthUser } | null {
  // Absent session (anonymous or already-rejected token) stays quiet.
  if (!session?.user) return null;

  const { id, email, role, name } = session.user;

  // Decrypted JWT claims are re-validated at this trust boundary. Missing or
  // unsupported roles are expected failures and stay quiet. Name is optional.
  if (!id || !email || !isRole(role)) return null;

  return {
    user: {
      id,
      email,
      role,
      ...(typeof name === "string" && name ? { name } : {}),
    },
  };
}

/**
 * Public session boundary:
 * - validates the signed JWT (signature, expiry, cookie presence)
 * - maps it to the domain session — no database lookup
 * - the immutable role stays trusted.
 * - Returns null for absent, malformed, expired, or invalidly signed tokens
 * - never redirects/throws when no session exists
 */
export async function getSession(request?: Request): Promise<{ user: AuthUser } | null> {
  const session = request ? await readSession(request) : await auth();
  return mapSession(session);
}
