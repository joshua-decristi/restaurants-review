/**
 * Private, server-only Auth.js wrapper (anti-corruption layer): Auth.js types
 * and APIs never leave this module; the users domain supplies credential
 * policy via `verifyCredentials` and receives stable primitives back.
 */

import type { DefaultSession, NextAuthConfig, User } from "next-auth";
import NextAuth from "next-auth";

import { serverEnv } from "@/lib/env/server";

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

export function createAuthjsAdapter(providers: NextAuthConfig["providers"]) {
  return NextAuth({
    secret: serverEnv.AUTH_SECRET,
    trustHost: true,
    session: { strategy: "jwt" },
    providers,
    callbacks: {
      // The verified role is baked into the signed JWT when credentials are
      // accepted; roles are immutable, so it stays trusted for the token's
      // lifetime and no database lookup is needed afterwards. Auth.js types
      // `user` as always present, but it is undefined on subsequent token
      // updates (e.g. session reads), so it is narrowed defensively.
      jwt: ({ token, user }) => {
        // On sign-in, Auth.js seeds the token with standard claims (sub/email/name)
        // from the authorized user; bake the verified role alongside them.
        const role = (user as User | undefined)?.role;
        return role ? { ...token, role } : token;
      },
      session: ({ session, token }) => ({
        ...session,
        user: {
          id: token.sub ?? "",
          email: token.email ?? "",
          name: token.name ?? undefined,
          role: token.role,
        },
      }),
    },
  });
}
