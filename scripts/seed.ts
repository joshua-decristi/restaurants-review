import "dotenv/config";

import { usersFactory } from "@/domains/users/server";
import { normalizeEmail } from "@/lib/auth/credentials/server";
import { closeDatabase, db } from "@/lib/db/server";
import { getSeedEnv } from "@/lib/env/server";

const seedEnv = getSeedEnv();

async function seedTestUsers() {
  const reviewerEmail = normalizeEmail(seedEnv.REVIEWER_USER_EMAIL);
  const ownerEmail = normalizeEmail(seedEnv.OWNER_USER_EMAIL);

  if (reviewerEmail === ownerEmail)
    throw new Error("REVIEWER_USER_EMAIL and OWNER_USER_EMAIL must be different addresses: a single login cannot hold both roles.");

  // Baseline accounts use explicit env credentials.
  const testUsers = [
    { role: "reviewer", email: reviewerEmail, password: seedEnv.REVIEWER_USER_PASSWORD },
    { role: "owner", email: ownerEmail, password: seedEnv.OWNER_USER_PASSWORD },
  ] as const;

  console.log("⏳ Seeding test users.");
  for (const user of testUsers) {
    await usersFactory(db).fakeUser(user, { upsert: true });
    console.log(`✅ → Seeded ${user.role} account.`);
  }
}

/**
 * Global baseline seeder: idempotent upserts of stable manual-login accounts.
 * Imports domain factories only through each domain's public server boundary.
 * Preserves unrelated data; safe to re-run.
 */
async function main(): Promise<void> {
  console.log("🌱 Seeding Database");
  console.log("\n");
  await seedTestUsers();
  console.log("\n");
  console.log("🎉 Seed Complete!");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
