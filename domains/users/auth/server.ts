import "server-only";

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { getServerLogger } from "@/lib/logging/server";

/**
 * Private, server-only Auth.js wrapper: an anti-corruption layer. Auth.js
 * types and APIs never leave this module; the users domain supplies all
 * credential policy through `verifyCredentials` and receives stable
 * primitives back. It has no consumers outside the users module.
 */

/** Stable session-user shape hidden behind the wrapper. */
export interface AuthUser {
  id: string;
  email: string;
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
  redirectTo: string;
}

interface AuthConfig {
  /** Session secret, supplied explicitly by the parent module. */
  secret: string;

  /**
   * Credential policy owned by the users domain: validate the input, look up
   * the user, and verify the password. Returning null fails the sign-in.
   */
  verifyCredentials: (credentials: unknown) => Promise<AuthUser | null>;
}

export function createAuth(config: AuthConfig) {
  const { handlers, signIn, signOut, auth } = NextAuth({
    secret: config.secret,
    trustHost: true,
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          const user = await config.verifyCredentials(credentials);
          if (user) getServerLogger().info("User authenticated", { userId: user.id });
          return user;
        },
      }),
    ],
    callbacks: {
      session: ({ session, token }) => ({
        ...session,
        user: { id: token.sub ?? "", email: token.email ?? "" },
      }),
    },
  });

  return {
    /** Next.js route handlers for `/api/auth/[...nextauth]`. */
    authRouteHandlers: handlers,

    /**
     * Credentials sign-in. A successful sign-in completes through a framework
     * redirect signal that must propagate; rejected credentials throw
     * `InvalidCredentialsError`.
     */
    signInCredentials: async ({ email, password, redirectTo }: CredentialsSignIn): Promise<void> => {
      try {
        await signIn("credentials", { email, password, redirectTo });
      } catch (error) {
        if (error instanceof CredentialsSignin) throw new InvalidCredentialsError();

        throw error;
      }
    },

    /** Signs the user out; completes through a framework redirect. */
    signOutSession: async (redirectTo: string): Promise<void> => {
      await signOut({ redirectTo });
    },

    /** Current session mapped to the stable wrapper user shape. */
    getSession: async (): Promise<{ user: AuthUser } | null> => {
      const session = await auth();
      const id = session?.user?.id;
      const email = session?.user?.email;
      if (!id || !email) return null;
      return { user: { id, email } };
    },
  };
}
