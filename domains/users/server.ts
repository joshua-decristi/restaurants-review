import "server-only";

import { redirect } from "next/navigation";

import { getServerLogger } from "@/lib/logging/server";

import { createAuth, InvalidCredentialsError } from "./auth/server";
import type { Role } from "./roles";

/**
 * Public server interface of the users domain: authentication operations,
 * the session boundary, and the role policy consumed by transport layers,
 * with all Auth.js specifics hidden behind the private auth sub-module.
 */

/** Domain-facing session: the identity trusted from the signed JWT. */
export interface Session {
  user: { id: string; email: string; role: Role };
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Result of a login attempt. A successful sign-in never produces `{ ok: true }`
 * at runtime — login exits through a role redirect — but the variant stays in
 * the contract so callers can branch on the result.
 */
export type LoginResult = { ok: true } | { ok: false; error: "invalid-credentials" };

/** The role-gated route prefix for each immutable role; this domain owns route-to-role policy. */
const ROLE_ROUTES = { reviewer: "/reviewer", owner: "/owner" } as const satisfies Record<Role, string>;

const { authRouteHandlers, signInCredentials, signOutSession, getSession: getSessionFromAuth } = createAuth();

/** Logs and returns the single opaque login failure. */
function rejectLogin(): LoginResult {
  getServerLogger().warn("Login rejected: invalid credentials");
  return { ok: false, error: "invalid-credentials" };
}

/**
 * Credentials sign-in:
 * - sets the signed session cookie (role baked into the JWT)
 * - redirects to the verified role's page
 * - failures return one opaque error so email existence is never leaked.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    const user = await signInCredentials(input);
    redirect(ROLE_ROUTES[user.role]);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return rejectLogin();
    throw error;
  }
}

/**
 * Public session boundary:
 * - validates the signed JWT (signature, expiry, cookie presence)
 * - maps it to the domain session — no database lookup
 * - the immutable role stays trusted.
 * - Returns null for absent, malformed, expired, or invalidly signed tokens
 * - never redirects/throws when no session exists
 */
export async function getSession(request?: Request): Promise<Session | null> {
  return getSessionFromAuth(request);
}

/** Signs the user out; completes via a framework redirect. */
export async function logout(redirectTo = "/"): Promise<void> {
  getServerLogger().info("User logged out");
  await signOutSession(redirectTo);
}

export { authRouteHandlers };
export type { Role } from "./roles";
