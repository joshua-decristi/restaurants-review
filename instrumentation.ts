import type { Instrumentation } from "next";

import { getServerLogger, initializeServerLogger } from "@/lib/logging/server";

// Preserve logger initialization (called once at module load; no-op after).
initializeServerLogger();

/**
 * Digest prefixes Next.js uses internally to implement router control flow
 * (`redirect()`, `notFound()`, `unauthorized()`, `forbidden()`, and SSR
 * bailouts). These signal expected outcomes, not unexpected server errors.
 */
const EXPECTED_ERROR_DIGEST_PREFIXES = [
  "NEXT_REDIRECT",
  "NEXT_HTTP_ERROR_FALLBACK", // notFound()/unauthorized()/forbidden()
  "NEXT_NOT_FOUND", // legacy notFound() digest
  "DYNAMIC_SERVER_USAGE",
  "NEXT_STATIC_GEN_BAILOUT",
  "NEXT_BAILOUT_TO_CLIENT_RENDERING",
] as const;

/** Cap logged field lengths so a single record stays bounded. */
const MAX_FIELD_LENGTH = 500;

const bounded = (value: string): string => (value.length <= MAX_FIELD_LENGTH ? value : `${value.slice(0, MAX_FIELD_LENGTH)}…`);

/** Strip query/fragment from a request path (paths may embed search params). */
const stripQuery = (path: string): string => path.split(/[?#]/, 1)[0] ?? "";

/** Next's control-flow errors carry their code in an untyped `digest` field. */
const getErrorDigest = (error: unknown): string | undefined => {
  if (error === null || typeof error !== "object") return undefined;
  const { digest } = error as { digest?: unknown };
  return typeof digest === "string" ? digest : undefined;
};

const isExpectedControlFlowError = (error: unknown): boolean => {
  const digest = getErrorDigest(error);
  return digest !== undefined && EXPECTED_ERROR_DIGEST_PREFIXES.some((prefix) => digest.startsWith(prefix));
};

/**
 * Centralized hook for unexpected server errors: logs only bounded, safe
 * context — never headers, body, query, cookies, stack traces, or secrets —
 * and filters out expected Next router control-flow errors (redirect, etc.).
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (isExpectedControlFlowError(error)) return;

  getServerLogger().error("Unexpected server error on {method} {path} ({routeType} {routePath})", {
    method: request.method,
    path: bounded(stripQuery(request.path)),
    routerKind: context.routerKind,
    routePath: bounded(context.routePath),
    routeType: context.routeType,
    revalidateReason: context.revalidateReason,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: bounded(error instanceof Error ? error.message : String(error)),
    digest: getErrorDigest(error),
  });
};
