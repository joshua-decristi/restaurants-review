import { DrizzleQueryError } from "drizzle-orm";

export interface PostgresConstraintError {
  code: string;
  constraint?: string;
}

/**
 * Unwrap one DrizzleQueryError.cause level and normalize Neon (`constraint`)
 * vs postgres.js (`constraint_name`) driver shapes.
 */
export function getPostgresConstraintError(error: unknown): PostgresConstraintError | undefined {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  if (typeof cause !== "object" || cause === null) return undefined;

  const candidate = cause as {
    code?: unknown;
    constraint?: unknown;
    constraint_name?: unknown;
  };

  if (typeof candidate.code !== "string") return undefined;

  const constraint =
    typeof candidate.constraint === "string" ? candidate.constraint : typeof candidate.constraint_name === "string" ? candidate.constraint_name : undefined;

  return { code: candidate.code, constraint };
}
