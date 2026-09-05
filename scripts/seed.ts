import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { restaurantsFactory, type RestaurantView } from "@/domains/restaurants/server";
import { reviewsFactory } from "@/domains/reviews/server";
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

  // Extra reviewers enable multi-rating lists without violating the unique pair constraint.
  const extraReviewers = [
    await usersApi.fakeUser({ role: "reviewer", name: "Sam Critic" }),
    await usersApi.fakeUser({ role: "reviewer", name: "Jordan Foodie" }),
    await usersApi.fakeUser({ role: "reviewer", name: "Casey Diner" }),
  ];
  console.log("✅ → Seeded extra reviewers.");

  return { owner, reviewer, extraReviewers };
}

async function seedRestaurants(ownerId: number): Promise<RestaurantView[]> {
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
  const created: RestaurantView[] = [];

  for (const filename of SEED_IMAGE_FILES) {
    const image = await loadSeedImage(filename);
    created.push(await restaurantsApi.fakeRestaurant({ ownerId, image }));
  }
  return created;
}

/**
 * Varied reviews across restaurants: multiple ratings, ordered lists, summaries,
 * and an existing review for the primary seeded reviewer (edit/delete smoke path).
 */
async function seedReviews(restaurants: RestaurantView[], reviewerId: number, extraReviewerIds: number[]): Promise<void> {
  if (restaurants.length < 3) throw new Error("Expected three seeded restaurants before seeding reviews.");
  if (extraReviewerIds.length < 3) throw new Error("Expected three extra reviewers before seeding reviews.");

  // Indexed after length guards; project tsconfig omits noUncheckedIndexedAccess.
  const first = restaurants[0];
  const second = restaurants[1];
  const third = restaurants[2];
  const samId = extraReviewerIds[0];
  const jordanId = extraReviewerIds[1];
  const caseyId = extraReviewerIds[2];

  const reviewsApi = reviewsFactory(db, { seed: 42 });

  const fixtures = [
    // Restaurant 1: mixed ratings so average and best→worst order are obvious.
    { restaurantId: first.id, reviewerId, rating: 5 as const, content: "Outstanding service and unforgettable flavors." },
    { restaurantId: first.id, reviewerId: samId, rating: 3 as const, content: "Solid meal, nothing extraordinary." },
    { restaurantId: first.id, reviewerId: jordanId, rating: 4 as const, content: "Would happily come back for the seasonal specials." },
    // Restaurant 2: lower ratings + primary reviewer already reviewed.
    { restaurantId: second.id, reviewerId, rating: 2 as const, content: "Slow kitchen and lukewarm plates." },
    { restaurantId: second.id, reviewerId: caseyId, rating: 1 as const, content: "Skipped dessert after a disappointing main." },
    // Restaurant 3: single glowing review for a sparse-summary case.
    { restaurantId: third.id, reviewerId: samId, rating: 5 as const, content: "Perfect date-night spot with a great wine list." },
  ];

  for (const fixture of fixtures) {
    await reviewsApi.fakeReview(fixture);
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

  console.log("⏳ Resetting local assets.");
  await resetLocalAssets();
  console.log("✅ → Local assets ready.");
  console.log("\n");

  console.log("🌱 Seeding Database");
  console.log("\n");

  console.log("⏳ Seeding test users.");
  const { owner, reviewer, extraReviewers } = await seedTestUsers();
  console.log("✅ Seeded test users.");
  console.log("\n");

  console.log("⏳ Seeding restaurants.");
  const restaurants = await seedRestaurants(owner.id);
  console.log("✅ Seeded restaurants.");
  console.log("\n");

  console.log("⏳ Seeding reviews.");
  await seedReviews(
    restaurants,
    reviewer.id,
    extraReviewers.map((user) => user.id),
  );
  console.log("✅ Seeded reviews.");
  console.log("\n");

  console.log("🎉 Seed Complete!");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
