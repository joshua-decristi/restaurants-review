/**
 * Private, server-only Auth.js wrapper (anti-corruption layer): Auth.js types
 * and APIs never leave this module; the users domain supplies credential
 * policy via `verifyCredentials` and receives stable primitives back.
 */

import type { DefaultSession, NextAuthConfig, User } from "next-auth";
import NextAuth, { AuthError } from "next-auth";

import { serverEnv } from "@/lib/env/server";
import { getServerLogger } from "@/lib/logging/server";

import type { AuthUser } from "./session";

type Role = AuthUser["role"];

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

const Logger = getServerLogger();

function logError(error: Error) {
  const type = error instanceof AuthError ? error.type : error.name;

  if (type === "JWTSessionError") Logger.warn("Session rejected: invalid token");
  else Logger.error(error);
}

export function createAuthjsAdapter(providers: NextAuthConfig["providers"]) {
  return NextAuth({
    secret: serverEnv.AUTH_SECRET,
    trustHost: true,
    session: { strategy: "jwt" },
    // Expected invalid tokens surface as JWTSessionError; log one concise
    // warning without a stack. Unexpected Auth.js failures keep full errors.
    logger: { error: logError },
    providers,
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
}
