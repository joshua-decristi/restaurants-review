/**
 * Integration test of the users module's public server boundary, not the
 * private Auth.js adapter:
 * - Real JWT encoding is test setup only: each case encodes a session JWT,
 *   passes a request with the session cookie, and asserts via `getSession`.
 * - The `@/lib/db/server` mock throws on access, so passing session tests
 *   prove session validation performs no user/database lookup.
 *
 * @jest-environment node
 */

import { encode } from "next-auth/jwt";

import { serverEnv } from "@/lib/env/server";
import { getServerLogger } from "@/lib/logging/server";

import { getSession } from "../server";

jest.mock("@/lib/env/server", () => ({
  serverEnv: { AUTH_SECRET: "integration-test-secret-0123456789abcdef" },
}));

jest.mock("@/lib/logging/server", () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
  return { getServerLogger: () => logger };
});

interface LoggerMock {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  fatal: jest.Mock;
}

const logger = getServerLogger() as unknown as LoggerMock;

jest.mock("@/lib/db/server", () => ({
  // Armed tripwire: any database access during session validation fails the
  // suite instead of silently proving nothing.
  db: new Proxy(
    {},
    {
      get(): never {
        throw new Error("Session validation must not touch the database.");
      },
    },
  ),
}));

/** Auth.js session-cookie name (non-secure variant, as served over http). */
const SESSION_COOKIE = "authjs.session-token";

const AUTH_SECRET = serverEnv.AUTH_SECRET;

/** Builds a request carrying only the session cookie, like a proxy request. */
function sessionRequest(token?: string): Request {
  const headers = new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" });
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new Request("http://localhost:3000/reviewer", { headers });
}

/** Encodes a real Auth.js session JWT for the given claims. */
async function sessionToken(claims: { sub: string; email: string; role?: string }, maxAge = 60 * 30): Promise<string> {
  return encode({ token: claims, secret: AUTH_SECRET, salt: SESSION_COOKIE, maxAge });
}

/** Asserts expected invalid-token handling: one warn, no error stacks. */
function expectOneConciseWarning(message: string) {
  expect(logger.warn.mock.calls).toEqual([[message]]);
  expect(logger.error.mock.calls).toHaveLength(0);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const reviewerClaims = { sub: "42", email: "reviewer@example.com", role: "reviewer" } as const;
const ownerClaims = { sub: "7", email: "owner@example.com", role: "owner" } as const;

it("returns the typed session for a correctly signed, unexpired reviewer JWT", async () => {
  const session = await getSession(sessionRequest(await sessionToken(reviewerClaims)));

  expect(session).toEqual({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
  expect(logger.warn.mock.calls).toHaveLength(0);
  expect(logger.error.mock.calls).toHaveLength(0);
});

it("returns the typed session for a correctly signed, unexpired owner JWT", async () => {
  const session = await getSession(sessionRequest(await sessionToken(ownerClaims)));

  expect(session).toEqual({ user: { id: "7", email: "owner@example.com", role: "owner" } });
  expect(logger.warn.mock.calls).toHaveLength(0);
  expect(logger.error.mock.calls).toHaveLength(0);
});

it("returns null without logging when no session cookie is present", async () => {
  expect(await getSession(sessionRequest())).toBeNull();
  expect(logger.warn.mock.calls).toHaveLength(0);
  expect(logger.error.mock.calls).toHaveLength(0);
});

it("returns null for a tampered token with one concise warning", async () => {
  const token = await sessionToken(reviewerClaims);
  const tampered = token.slice(0, 20) + "00000000" + token.slice(28);

  expect(await getSession(sessionRequest(tampered))).toBeNull();
  expectOneConciseWarning("Session rejected: invalid token");
});

it("returns null for an expired token with one concise warning", async () => {
  const expired = await sessionToken(reviewerClaims, -60);

  expect(await getSession(sessionRequest(expired))).toBeNull();
  expectOneConciseWarning("Session rejected: invalid token");
});

it("returns null for missing or unsupported role claims with one concise warning each", async () => {
  const missingRole = await sessionToken({ sub: "42", email: "reviewer@example.com" });
  const unsupportedRole = await sessionToken({ sub: "42", email: "reviewer@example.com", role: "admin" });

  expect(await getSession(sessionRequest(missingRole))).toBeNull();
  expectOneConciseWarning("Session rejected: invalid claims");

  jest.clearAllMocks();

  expect(await getSession(sessionRequest(unsupportedRole))).toBeNull();
  expectOneConciseWarning("Session rejected: invalid claims");
});
