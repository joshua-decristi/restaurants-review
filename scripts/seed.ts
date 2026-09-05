import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { restaurantsFactory } from "@/domains/restaurants/server";
import { usersFactory } from "@/domains/users/server";
import { resetLocalAssets } from "@/lib/assets/server";
import { normalizeEmail } from "@/lib/auth/credentials/server";
import { closeDatabase, db, resetDatabase } from "@/lib/db/server";
import { getSeedEnv } from "@/lib/env/server";

const seedEnv = getSeedEnv();

/** Three demo images; the other two raw fixtures stay reserved for tests. */
const SEED_IMAGE_FILES = ["brasserie-paris.webp", "cafe-mystique.webp", "chinese-punk.webp"] as const;
const SEED_IMGS_DIR = join(process.cwd(), "seed/assets");

async function seedTestUsers() {
  // Baseline accounts use explicit env credentials and public display names.
  const reviewerSeed = {
    role: "reviewer",
    name: "Alex Reviewer",
    email: normalizeEmail(seedEnv.REVIEWER_USER_EMAIL),
    password: seedEnv.REVIEWER_USER_PASSWORD,
  } as const;

  const ownerSeed = {
    role: "owner",
    name: "Olivia Owner",
    email: normalizeEmail(seedEnv.OWNER_USER_EMAIL),
    password: seedEnv.OWNER_USER_PASSWORD,
  } as const;

  if (reviewerSeed.email === ownerSeed.email)
    throw new Error("REVIEWER_USER_EMAIL and OWNER_USER_EMAIL must be different addresses: a single login cannot hold both roles.");

  const usersApi = usersFactory(db, { seed: 42 });

  const reviewer = await usersApi.fakeUser(reviewerSeed);
  console.log("✅ → Seeding reviewer account.");

  const owner = await usersApi.fakeUser(ownerSeed);
  console.log("✅ → Seeded owner account.");

  return { owner, reviewer };
}

async function seedRestaurants(ownerId: number) {
  function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  /** JPEG / PNG / WebP only — matches the asset allowlist; never trust the filename. */
  function mimeFromMagic(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" {
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    // RIFF....WEBP
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) {
      return "image/webp";
    }
    throw new Error("Seed fixture is not a JPEG, PNG, or WebP image (magic bytes).");
  }

  async function loadSeedImage(filename: (typeof SEED_IMAGE_FILES)[number]): Promise<File> {
    const buffer = await readFile(join(SEED_IMGS_DIR, filename));
    const bytes = new Uint8Array(buffer);
    const type = mimeFromMagic(bytes);
    // File is available in Node 26+; type comes from content, not the filename.
    return new File([bytes], filename, { type });
  }

  const restaurantsApi = restaurantsFactory(db, { seed: 42 });
  for (const filename of SEED_IMAGE_FILES) {
    console.log("⏳ Seeding restaurants with fixture image.");
    const image = await loadSeedImage(filename);
    await restaurantsApi.fakeRestaurant({ ownerId, image });
    console.log(`✅ → Seeded restaurant`);
  }
}

/**
 * Global baseline seeder: destructive reset-first demo dataset.
 * Imports domain/asset factories only through public server boundaries.
 */
async function main(): Promise<void> {
  console.log("⏳ Resetting database.");
  const { tableCount } = await resetDatabase(db);
  console.log(`✅ → Truncated ${String(tableCount)} table${tableCount === 1 ? "" : "s"}.`);
  console.log("\n");

  console.log("⏳ Resetting local assets.");
  await resetLocalAssets();
  console.log("✅ → Local assets ready.");
  console.log("\n");

  console.log("🌱 Seeding Database");
  console.log("\n");

  console.log("⏳ Seeding test users.");
  const { owner } = await seedTestUsers();
  console.log("✅ Seeded test users.");
  console.log("\n");

  console.log("⏳ Seeding restaurants.");
  await seedRestaurants(owner.id);
  console.log("✅ Seeded restaurants.");

  console.log("🎉 Seed Complete!");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
