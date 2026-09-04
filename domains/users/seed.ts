import "dotenv/config";

import { closeDatabase, db } from "@/lib/db/server";
import { getSeedEnv } from "@/lib/env/server";

import { normalizeEmail } from "./credentials";
import { hashPassword } from "./password";
import type { Role } from "./roles";
import { users } from "./schema";

/** One seeded login per immutable role; the email is stored normalized. */
export interface SeedAccount {
  role: Role;
  email: string;
  password: string;
}

/** Validated seed-environment values (the parsed result of `getSeedEnv()`). */
export interface SeedEnv {
  REVIEWER_USER_EMAIL: string;
  REVIEWER_USER_PASSWORD: string;
  OWNER_USER_EMAIL: string;
  OWNER_USER_PASSWORD: string;
}

/**
 * Seeds exactly one account per role via idempotent upsert (direct insert is
 * the sanctioned customization over drizzle-seed: the hash derives from env
 * config). Re-running restores each account's configured role and password.
 */
async function main(): Promise<void> {
  const seedEnv = getSeedEnv();
  const accounts = [
    {
      role: "reviewer",
      email: normalizeEmail(seedEnv.REVIEWER_USER_EMAIL),
      password: seedEnv.REVIEWER_USER_PASSWORD,
    },
    {
      role: "owner",
      email: normalizeEmail(seedEnv.OWNER_USER_EMAIL),
      password: seedEnv.OWNER_USER_PASSWORD,
    },
  ] as const;

  if (accounts[0].email === accounts[1].email)
    throw new Error("REVIEWER_USER_EMAIL and OWNER_USER_EMAIL must be different addresses: a single login cannot hold both roles.");

  for (const { role, email, password } of accounts) {
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({ email, passwordHash, role }).onConflictDoUpdate({ target: users.email, set: { passwordHash, role } });

    console.log(`Seeded ${role} account.`);
  }
}

main()
  .then(() => closeDatabase())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
