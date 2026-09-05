import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { hashPassword } from "@/lib/auth/password/server";
import { db as rootDb } from "@/lib/db/server";

import { getPostgresConstraintError } from "./postgres-error";
import { type User, users } from "./schema";
import { type RegisterUserInput, registerUserInputSchema } from "./validation";

/**
 * PostgresJsDatabase | NeonHttpDatabase collapses `.returning(fields)` overloads.
 * PgDatabase restores the shared PostgreSQL builder surface both drivers implement.
 */
const db: PgDatabase<PgQueryResultHKT> = rootDb;

export type PublicUser = Pick<User, "id" | "email" | "name" | "role">;

export type RegisterUserResult =
  { ok: true; user: PublicUser } | { ok: false; error: "validation"; fieldErrors: Record<string, string> } | { ok: false; error: "already-exists" };

export async function registerUser(input: RegisterUserInput): Promise<RegisterUserResult> {
  const parsed = registerUserInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      if (!Object.hasOwn(fieldErrors, path)) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "validation", fieldErrors };
  }

  const { name, email, password, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const [row] = await db.insert(users).values({ name, email, passwordHash, role }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive
    if (row === undefined) throw new Error("registerUser: insert returned no row");
    return { ok: true, user: row };
  } catch (error) {
    const pg = getPostgresConstraintError(error);
    if (pg?.code === "23505" && pg.constraint === "users_email_unique") return { ok: false, error: "already-exists" };
    throw error;
  }
}
