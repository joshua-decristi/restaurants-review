/**
 * Public users/auth session coverage plus one real-database factory case.
 * Session cases use JWT encoding as setup only and assert via `getSession`.
 *
 * @jest-environment node
 */

import { encode } from "next-auth/jwt";
import { eq } from "drizzle-orm";

import { verifyPassword } from "@/lib/auth/password/server";
import { getSession } from "@/lib/auth/server";
import { closeDatabase, db, resetDatabase } from "@/lib/db/server";
import { serverEnv } from "@/lib/env/server";

import { userNameSchema, users, usersFactory } from "../server";

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

/**
 * Auth.js surfaces expected JWT failures (tampered/expired tokens) through its
 * default console.error logger. Mutes that output for one session read, asserts
 * the expected JWTSessionError diagnostics occurred, and restores console.error
 * even when assertions fail.
 */
async function expectSessionRejectedAndLogged(request: Request): Promise<void> {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await expect(getSession(request)).resolves.toBeNull();
    expect(consoleError.mock.calls.some(([line]) => String(line).includes("JWTSessionError"))).toBe(true);
  } finally {
    consoleError.mockRestore();
  }
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const reviewerClaims = { sub: "42", email: "reviewer@example.com", role: "reviewer" } as const;
const ownerClaims = { sub: "7", email: "owner@example.com", role: "owner" } as const;

it("returns the typed session for a correctly signed, unexpired reviewer JWT", async () => {
  const session = await getSession(sessionRequest(await sessionToken(reviewerClaims)));

  expect(session).toEqual({ user: { id: "42", email: "reviewer@example.com", role: "reviewer" } });
});

it("returns the typed session for a correctly signed, unexpired owner JWT", async () => {
  const session = await getSession(sessionRequest(await sessionToken(ownerClaims)));

  expect(session).toEqual({ user: { id: "7", email: "owner@example.com", role: "owner" } });
});

it("returns null when no session cookie is present", async () => {
  expect(await getSession(sessionRequest())).toBeNull();
});

it("returns null for a tampered token", async () => {
  const token = await sessionToken(reviewerClaims);
  const tampered = token.slice(0, 20) + "00000000" + token.slice(28);

  await expectSessionRejectedAndLogged(sessionRequest(tampered));
});

it("returns null for an expired token", async () => {
  const expired = await sessionToken(reviewerClaims, -60);

  await expectSessionRejectedAndLogged(sessionRequest(expired));
});

it("returns null for missing or unsupported role claims", async () => {
  const missingRole = await sessionToken({ sub: "42", email: "reviewer@example.com" });
  const unsupportedRole = await sessionToken({ sub: "42", email: "reviewer@example.com", role: "admin" });

  expect(await getSession(sessionRequest(missingRole))).toBeNull();

  expect(await getSession(sessionRequest(unsupportedRole))).toBeNull();
});

it("persists a factory user with normalized email, role, display name, and hashed password", async () => {
  const plaintextPassword = "known-integration-password";
  const mixedEmail = "  Owner.User@Example.COM ";
  const paddedName = "  Ada Lovelace  ";

  const created = await usersFactory(db).fakeUser({
    email: mixedEmail,
    role: "owner",
    password: plaintextPassword,
    name: paddedName,
  });

  const rows = await db.select().from(users).where(eq(users.id, created.id));
  expect(rows).toHaveLength(1);
  const persisted = rows[0];

  expect(persisted.email).toBe("owner.user@example.com");
  expect(persisted.role).toBe("owner");
  expect(persisted.name).toBe("Ada Lovelace");
  expect(persisted.name.length).toBeGreaterThanOrEqual(1);
  expect(persisted.name.length).toBeLessThanOrEqual(100);
  expect(persisted.passwordHash).not.toBe(plaintextPassword);
  expect(JSON.stringify(persisted)).not.toContain(plaintextPassword);
  expect(created).not.toHaveProperty("password");
  await expect(verifyPassword(plaintextPassword, persisted.passwordHash)).resolves.toBe(true);
});

it("factory default name is trimmed and within 1–100 characters", async () => {
  const created = await usersFactory(db).fakeUser();

  expect(created.name).toBe(created.name.trim());
  expect(created.name.length).toBeGreaterThanOrEqual(1);
  expect(created.name.length).toBeLessThanOrEqual(100);
  expect(userNameSchema.safeParse(created.name).success).toBe(true);
});

it.each([
  { name: "", label: "empty" },
  { name: "   ", label: "whitespace-only" },
  { name: "x".repeat(101), label: "over-100" },
] as const)("rejects $label display names", ({ name }) => {
  expect(userNameSchema.safeParse(name).success).toBe(false);
});

it("accepts boundary display names of length 1 and 100", () => {
  expect(userNameSchema.parse("A")).toBe("A");
  expect(userNameSchema.parse("x".repeat(100))).toHaveLength(100);
  expect(userNameSchema.parse("  Trimmed  ")).toBe("Trimmed");
});
