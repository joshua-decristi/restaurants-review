import "dotenv/config";

import { closeDatabase, db } from "@/lib/db/server";
import { getSeedEnv } from "@/lib/env/server";

import { normalizeEmail } from "./credentials";
import { hashPassword } from "./password";
import { users } from "./schema";

/**
 * Seeds exactly one development user with an idempotent upsert (a direct
 * insert is the sanctioned customization over drizzle-seed here, because the
 * password hash must be derived from the environment's development password).
 * Re-running the seed resets the development user's password to the
 * documented value: hashes are salted, so the stored hash changes every run
 * while the password stays usable.
 */
async function main(): Promise<void> {
  const seedEnv = getSeedEnv();
  const email = normalizeEmail(seedEnv.DEVELOPMENT_USER_EMAIL);
  const passwordHash = await hashPassword(seedEnv.DEVELOPMENT_USER_PASSWORD);

  await db.insert(users).values({ email, passwordHash }).onConflictDoUpdate({ target: users.email, set: { passwordHash } });

  console.log(`Seeded development user: ${email}`);
}

main()
  .then(() => closeDatabase())
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
