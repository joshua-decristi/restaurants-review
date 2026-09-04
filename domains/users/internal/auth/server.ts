import "server-only";

import type { DefaultSession, Session, User } from "next-auth";
import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { serverEnv } from "@/lib/env/server";
import { getServerLogger } from "@/lib/logging/server";

import { credentialsSchema } from "../credentials/server";
import { verifyPassword } from "../password/server";
import { isRole, type Role } from "../roles";

import { getUserByEmail } from "./queries";

/**
 * Private, server-only Auth.js wrapper (anti-corruption layer): Auth.js types
 * and APIs never leave this module; the users domain supplies credential
 * policy via `verifyCredentials` and receives stable primitives back.
 */

// Module augmentation: the role verified at sign-in is baked into the JWT and
// copied through to the session. These shapes stay private to this sub-module.
declare module "next-auth" {
  interface User {
    role?: Role;
  }

  interface Session {
    user?: { id?: string; role?: Role } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}

/** Stable session-user shape hidden behind the wrapper. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Thrown when the credentials provider rejects a sign-in attempt. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

interface CredentialsSignIn {
  email: string;
  password: string;
}

/**
 * Credential policy owned by this domain: validate the input, look up the
 * user, verify the password, and derive the trusted role. Returning null
 * fails authentication.
 */
async function verifyCredentials(raw: unknown): Promise<AuthUser | null> {
  const credentials = credentialsSchema.safeParse(raw);
  if (!credentials.success) return null;

  const user = await getUserByEmail(credentials.data.email);
  if (!user) return null;

  const isValid = await verifyPassword(credentials.data.password, user.passwordHash);
  return isValid ? { id: String(user.id), email: user.email, role: user.role } : null;
}

export function createAuth() {
  const { handlers, signIn, signOut, auth } = NextAuth({
    secret: serverEnv.AUTH_SECRET,
    trustHost: true,
    session: { strategy: "jwt" },
    // Expected invalid tokens surface as JWTSessionError; log one concise
    // warning without a stack. Unexpected Auth.js failures keep full errors.
    logger: {
      error(error) {
        const type = error instanceof AuthError ? error.type : error.name;
        if (type === "JWTSessionError") {
          getServerLogger().warn("Session rejected: invalid token");
          return;
        }
        getServerLogger().error(error);
      },
    },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          const user = await verifyCredentials(credentials);
          if (user) getServerLogger().info("User authenticated", { userId: user.id });
          return user;
        },
      }),
    ],
    callbacks: {
      // The verified role is baked into the signed JWT when credentials are
      // accepted; roles are immutable, so it stays trusted for the token's
      // lifetime and no database lookup is needed afterwards. Auth.js types
      // `user` as always present, but it is undefined on subsequent token
      // updates (e.g. session reads), so it is narrowed defensively.
      jwt: ({ token, user }) => {
        const role = (user as User | undefined)?.role;
        return role ? { ...token, role } : token;
      },
      session: ({ session, token }) => ({
        ...session,
        user: { id: token.sub ?? "", email: token.email ?? "", role: token.role },
      }),
    },
  });

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

    const id = session.user.id;
    const email = session.user.email;
    const role = session.user.role;
    // Decrypted JWT claims are re-validated at this trust boundary. Missing or
    // unsupported roles are expected failures: one concise warning, no stack.
    if (!id || !email || !isRole(role)) {
      getServerLogger().warn("Session rejected: invalid claims");
      return null;
    }
    return { user: { id, email, role } };
  }

  return {
    /** Next.js route handlers for `/api/auth/[...nextauth]`. */
    authRouteHandlers: handlers,

    /**
     * Credentials sign-in:
     * - successful sign-in return validated user (2nd lookup required to get User record)
     * - Rejected credentials throw `InvalidCredentialsError`.
     */
    signInCredentials: async ({ email, password }: CredentialsSignIn): Promise<AuthUser> => {
      await signIn("credentials", { email, password, redirect: false }).catch((error: unknown) => {
        if (error instanceof CredentialsSignin) throw new InvalidCredentialsError();
        throw error;
      });

      // If no error is thrown, sign-in is successful & email exists
      const user = await getUserByEmail(email);
      if (!user) throw new InvalidCredentialsError();

      return { id: String(user.id), email: user.email, role: user.role };
    },

    /** Signs the user out; completes through a framework redirect. */
    signOutSession: async (redirectTo: string): Promise<void> => {
      await signOut({ redirectTo });
    },

    /**
     * Session mapped to the stable wrapper user shape, read from the given
     * request or the framework's request context. Returns null for absent,
     * malformed, expired, or invalidly signed tokens.
     */
    getSession: async (request?: Request): Promise<{ user: AuthUser } | null> => {
      const session = request ? await readSession(request) : await auth();
      return mapSession(session);
    },
  };
}
