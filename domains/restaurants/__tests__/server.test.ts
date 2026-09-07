/**
 * Public restaurants domain integration contracts.
 *
 * @jest-environment node
 */

import { eq, sql } from "drizzle-orm";

import {
  addresses,
  createRestaurant,
  type CreateRestaurantInput,
  deleteRestaurant,
  getRestaurant,
  getRestaurantFilterOptions,
  listRestaurants,
  listRestaurantsByOwner,
  restaurants,
  restaurantsFactory,
  updateRestaurant,
} from "@/domains/restaurants/server";
import { createReview, reviewsFactory } from "@/domains/reviews/server";
import { usersFactory } from "@/domains/users/server";
import * as assets from "@/lib/assets/server";
import { closeDatabase, db, resetDatabase } from "@/lib/db/server";

jest.mock("@/lib/assets/server", () => ({
  uploadAsset: jest.fn((file: File) => Promise.resolve(`key-${file.name}-${String(file.size)}`)),
  deleteAsset: jest.fn(() => Promise.resolve(undefined)),
  resolveAssetUrl: jest.fn((key: string) => `/api/assets/${encodeURIComponent(key)}`),
  resetLocalAssets: jest.fn(() => Promise.resolve(undefined)),
  readLocalAsset: jest.fn(() => Promise.resolve(null)),
}));

const uploadAsset = jest.mocked(assets.uploadAsset);
const deleteAsset = jest.mocked(assets.deleteAsset);
const resolveAssetUrl = jest.mocked(assets.resolveAssetUrl);

const TINY_PNG = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x02,
  0x00,
  0x00,
  0x00,
  0x90,
  0x77,
  0x53,
  0xde,
  0x00,
  0x00,
  0x00,
  0x0c,
  0x49,
  0x44,
  0x41,
  0x54,
  0x08,
  0xd7,
  0x63,
  0xf8,
  0xcf,
  0xc0,
  0x00,
  0x00,
  0x00,
  0x03,
  0x00,
  0x01,
  0x00,
  0x05,
  0xfe,
  0xd4,
  0xef,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
);

const tinyPng = new File([TINY_PNG], "tiny.png", { type: "image/png" });
// Minimal JPEG SOI/EOI markers — enough for MIME/size validation (assets mocked).
const jpegA = new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9)], "image-a.jpg", { type: "image/jpeg" });
const jpegB = new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xd9, 0x00)], "image-b.jpg", { type: "image/jpeg" });

function validInput(overrides: Partial<CreateRestaurantInput> = {}): CreateRestaurantInput {
  return {
    title: "Noodle House",
    description: "Hand-pulled noodles and broth.",
    cuisine: "Chinese",
    address: {
      street: "1 Main St",
      city: "Austin",
      stateRegion: "TX",
      postalCode: "78701",
      country: "US",
    },
    ...overrides,
  };
}

/** Unseeded users factory so concurrent cases never collide on deterministic emails. */
const usersApi = () => usersFactory(db);

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  jest.clearAllMocks();
  uploadAsset.mockImplementation((file: File) => Promise.resolve(`key-${file.name}-${String(file.size)}`));
  deleteAsset.mockImplementation(() => Promise.resolve(undefined));
  resolveAssetUrl.mockImplementation((key: string) => `/api/assets/${encodeURIComponent(key)}`);
});

afterAll(async () => {
  await closeDatabase();
});

describe("public reads", () => {
  it("lists and fetches restaurants with nested address and imageUrl, never imageKey", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const created = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Listed Cafe" });

    const listed = await listRestaurants();
    const row = listed.find((r) => r.id === created.id);
    expect(row).toBeDefined();
    if (row === undefined) return;

    expect(row).toMatchObject({
      title: "Listed Cafe",
      imageUrl: expect.stringMatching(/^\/api\/assets\//) as string,
      address: expect.objectContaining({ city: expect.any(String) as string }) as Record<string, unknown>,
      ownerId: owner.id,
    });
    expect(row).not.toHaveProperty("imageKey");
    expect(JSON.stringify(row)).not.toContain("imageKey");
    expect(row.averageRating).toBeNull();
    expect(row.reviewCount).toBe(0);

    const one = await getRestaurant(created.id);
    expect(one).toMatchObject({
      id: row.id,
      title: row.title,
      imageUrl: row.imageUrl,
      address: row.address,
      ownerId: row.ownerId,
    });
    expect(one).not.toHaveProperty("averageRating");
    expect(await getRestaurant(9_999_999)).toBeNull();
  });

  it("lists only restaurants owned by the given owner", async () => {
    const ownerA = await usersApi().fakeUser({ role: "owner" });
    const ownerB = await usersApi().fakeUser({ role: "owner" });
    const a = await restaurantsFactory(db).fakeRestaurant({ ownerId: ownerA.id, title: "A Spot" });
    const b = await restaurantsFactory(db).fakeRestaurant({ ownerId: ownerB.id, title: "B Spot" });

    const listedA = await listRestaurantsByOwner(ownerA.id);
    const listedB = await listRestaurantsByOwner(ownerB.id);

    expect(listedA.map((r) => r.id)).toEqual(expect.arrayContaining([a.id]));
    expect(listedA.map((r) => r.id)).not.toEqual(expect.arrayContaining([b.id]));
    expect(listedB.map((r) => r.id)).toEqual(expect.arrayContaining([b.id]));
    expect(listedB.map((r) => r.id)).not.toEqual(expect.arrayContaining([a.id]));
    expect(await listRestaurantsByOwner(0)).toEqual([]);
  });
});

describe("owner create", () => {
  it("creates restaurant + address for an owner and rejects non-owners before upload", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });

    const beforeAddresses = await db.select().from(addresses);
    const beforeRestaurants = await db.select().from(restaurants);

    const ok = await createRestaurant(owner.id, validInput({ title: "Owner Spot" }), tinyPng);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.data.title).toBe("Owner Spot");
    expect(ok.data.imageUrl).toMatch(/^\/api\/assets\//);
    expect(ok.data).not.toHaveProperty("imageKey");
    expect(uploadAsset).toHaveBeenCalledTimes(1);

    const afterAddresses = await db.select().from(addresses);
    const afterRestaurants = await db.select().from(restaurants);
    expect(afterAddresses.length - beforeAddresses.length).toBe(1);
    expect(afterRestaurants.length - beforeRestaurants.length).toBe(1);

    jest.clearAllMocks();
    const denied = await createRestaurant(reviewer.id, validInput({ title: "Nope" }), tinyPng);
    expect(denied).toEqual({ ok: false, error: "not-owner" });
    expect(uploadAsset).not.toHaveBeenCalled();

    const missing = await createRestaurant(9_999_999, validInput(), tinyPng);
    expect(missing).toEqual({ ok: false, error: "not-owner" });
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("requires a valid image on create", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const bad = new File([Uint8Array.of(1, 2, 3)], "x.gif", { type: "image/gif" });
    const result = await createRestaurant(owner.id, validInput(), bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("validation");
    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("rejects missing required restaurant and address fields before upload", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const incomplete = {
      title: "",
      description: "desc",
      cuisine: "Thai",
      address: { street: "1", city: "A", stateRegion: "TX", postalCode: "1", country: "US" },
    };
    const result = await createRestaurant(owner.id, incomplete, tinyPng);
    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(uploadAsset).not.toHaveBeenCalled();

    const missingAddressField = await createRestaurant(
      owner.id,
      {
        title: "Ok",
        description: "Ok",
        cuisine: "Ok",
        address: { street: "1", city: "", stateRegion: "TX", postalCode: "1", country: "US" },
      },
      tinyPng,
    );
    expect(missingAddressField).toMatchObject({ ok: false, error: "validation" });
    expect(uploadAsset).not.toHaveBeenCalled();
  });
});

describe("create CTE atomicity and cleanup", () => {
  it("rolls back address when restaurant insert fails and cleans up the uploaded key", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const beforeAddresses = await db.select().from(addresses);
    const beforeRestaurants = await db.select().from(restaurants);

    uploadAsset.mockResolvedValueOnce("orphan-key-to-clean");
    await db.execute(sql`ALTER TABLE restaurants ADD CONSTRAINT restaurants_title_not_boom CHECK (title <> 'BOOM_FAIL_CTE')`);
    try {
      await expect(createRestaurant(owner.id, validInput({ title: "BOOM_FAIL_CTE" }), tinyPng)).rejects.toThrow();
      expect(deleteAsset).toHaveBeenCalledWith("orphan-key-to-clean");

      const afterAddresses = await db.select().from(addresses);
      const afterRestaurants = await db.select().from(restaurants);
      expect(afterAddresses.length).toBe(beforeAddresses.length);
      expect(afterRestaurants.length).toBe(beforeRestaurants.length);
    } finally {
      await db.execute(sql`ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_title_not_boom`);
    }
  });

  it("preserves the original DB error when cleanup also fails", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    uploadAsset.mockResolvedValueOnce("key-cleanup-fails");
    deleteAsset.mockRejectedValueOnce(new Error("cleanup blew up"));

    await db.execute(sql`ALTER TABLE restaurants ADD CONSTRAINT restaurants_title_not_boom2 CHECK (title <> 'BOOM_FAIL_CLEAN')`);
    try {
      await expect(createRestaurant(owner.id, validInput({ title: "BOOM_FAIL_CLEAN" }), tinyPng)).rejects.toThrow();
    } finally {
      await db.execute(sql`ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_title_not_boom2`);
    }
  });
});

describe("partial owner update", () => {
  it("updates single restaurant and address fields; rejects empty and foreign owners", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const other = await usersApi().fakeUser({ role: "owner" });
    const created = await createRestaurant(owner.id, validInput({ title: "Original", description: "Keep me" }), tinyPng);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const titleOnly = await updateRestaurant(owner.id, created.data.id, { title: "Renamed" });
    expect(titleOnly.ok).toBe(true);
    if (!titleOnly.ok) return;
    expect(titleOnly.data.title).toBe("Renamed");
    expect(titleOnly.data.description).toBe("Keep me");

    const cityOnly = await updateRestaurant(owner.id, created.data.id, { address: { city: "Dallas" } });
    expect(cityOnly.ok).toBe(true);
    if (!cityOnly.ok) return;
    expect(cityOnly.data.address.city).toBe("Dallas");
    expect(cityOnly.data.address.street).toBe("1 Main St");

    const empty = await updateRestaurant(owner.id, created.data.id, {});
    expect(empty).toMatchObject({ ok: false, error: "validation" });

    const blank = await updateRestaurant(owner.id, created.data.id, { title: "   " });
    expect(blank).toMatchObject({ ok: false, error: "validation" });

    const foreign = await updateRestaurant(other.id, created.data.id, { title: "Stolen" });
    expect(foreign).toEqual({ ok: false, error: "not-found" });
    const still = await getRestaurant(created.data.id);
    expect(still?.title).toBe("Renamed");
  });

  it("supports image-only replacement and cleans up missing-target uploads", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    uploadAsset.mockResolvedValueOnce("old-key");
    const created = await createRestaurant(owner.id, validInput({ title: "Photo Spot" }), jpegA);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    uploadAsset.mockResolvedValueOnce("new-key");
    const replaced = await updateRestaurant(owner.id, created.data.id, {}, jpegB);
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.data.imageUrl).toContain(encodeURIComponent("new-key"));
    expect(deleteAsset).toHaveBeenCalledWith("old-key");

    const row = (await db.select().from(restaurants).where(eq(restaurants.id, created.data.id))).at(0);
    expect(row?.imageKey).toBe("new-key");

    deleteAsset.mockClear();
    uploadAsset.mockResolvedValueOnce("fail-key");
    const missing = await updateRestaurant(owner.id, 9_999_999, {}, jpegB);
    expect(missing).toEqual({ ok: false, error: "not-found" });
    expect(deleteAsset).toHaveBeenCalledWith("fail-key");
  });

  it("deletes the replacement image and retains the old key when the DB update fails", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    uploadAsset.mockResolvedValueOnce("kept-old-key");
    const created = await createRestaurant(owner.id, validInput({ title: "Stable Photo" }), jpegA);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    uploadAsset.mockResolvedValueOnce("doomed-new-key");
    await db.execute(sql`ALTER TABLE restaurants ADD CONSTRAINT restaurants_image_key_not_doomed CHECK (image_key <> 'doomed-new-key')`);
    try {
      await expect(updateRestaurant(owner.id, created.data.id, { title: "Still Photo" }, jpegB)).rejects.toThrow();
      expect(deleteAsset).toHaveBeenCalledWith("doomed-new-key");

      const row = (await db.select().from(restaurants).where(eq(restaurants.id, created.data.id))).at(0);
      expect(row?.imageKey).toBe("kept-old-key");
      expect(row?.title).toBe("Stable Photo");
    } finally {
      await db.execute(sql`ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_image_key_not_doomed`);
    }
  });
});

describe("owner delete", () => {
  it("hard-deletes restaurant and address, then best-effort deletes the image", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const other = await usersApi().fakeUser({ role: "owner" });
    uploadAsset.mockResolvedValueOnce("delete-me-key");
    const created = await createRestaurant(owner.id, validInput({ title: "Temp" }), tinyPng);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const addressCountBefore = (await db.select().from(addresses)).length;
    const restaurantCountBefore = (await db.select().from(restaurants)).length;

    deleteAsset.mockRejectedValueOnce(new Error("storage down"));
    const deleted = await deleteRestaurant(owner.id, created.data.id);
    expect(deleted).toEqual({ ok: true, data: null });

    expect((await db.select().from(addresses)).length).toBe(addressCountBefore - 1);
    expect((await db.select().from(restaurants)).length).toBe(restaurantCountBefore - 1);
    expect(await getRestaurant(created.data.id)).toBeNull();

    const again = await deleteRestaurant(owner.id, created.data.id);
    expect(again).toEqual({ ok: false, error: "not-found" });

    uploadAsset.mockResolvedValueOnce("other-key");
    const otherRestaurant = await createRestaurant(other.id, validInput({ title: "Other" }), tinyPng);
    expect(otherRestaurant.ok).toBe(true);
    if (!otherRestaurant.ok) return;
    expect(await deleteRestaurant(owner.id, otherRestaurant.data.id)).toEqual({ ok: false, error: "not-found" });
  });
});

describe("validation matrix", () => {
  it("enforces field lengths, cuisine whitespace collapse, and image constraints", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });

    const longTitle = await createRestaurant(owner.id, validInput({ title: "x".repeat(121) }), tinyPng);
    expect(longTitle).toMatchObject({ ok: false, error: "validation" });

    const longDescription = await createRestaurant(owner.id, validInput({ description: "d".repeat(2001) }), tinyPng);
    expect(longDescription).toMatchObject({ ok: false, error: "validation" });

    const longCuisine = await createRestaurant(owner.id, validInput({ cuisine: "c".repeat(61) }), tinyPng);
    expect(longCuisine).toMatchObject({ ok: false, error: "validation" });

    const longStreet = await createRestaurant(
      owner.id,
      validInput({ address: { street: "s".repeat(101), city: "A", stateRegion: "TX", postalCode: "1", country: "US" } }),
      tinyPng,
    );
    expect(longStreet).toMatchObject({ ok: false, error: "validation" });

    const longPostal = await createRestaurant(
      owner.id,
      validInput({ address: { street: "1", city: "A", stateRegion: "TX", postalCode: "p".repeat(21), country: "US" } }),
      tinyPng,
    );
    expect(longPostal).toMatchObject({ ok: false, error: "validation" });

    uploadAsset.mockClear();
    const cuisine = await createRestaurant(owner.id, validInput({ cuisine: "  Thai   food  " }), tinyPng);
    expect(cuisine.ok).toBe(true);
    if (cuisine.ok) expect(cuisine.data.cuisine).toBe("Thai food");

    uploadAsset.mockClear();
    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    const oversized = await createRestaurant(owner.id, validInput({ title: "Big" }), huge);
    expect(oversized).toMatchObject({ ok: false, error: "validation" });
    expect(uploadAsset).not.toHaveBeenCalled();

    // Boundary success: max lengths accepted.
    const maxed = await createRestaurant(
      owner.id,
      validInput({
        title: "t".repeat(120),
        description: "d".repeat(2000),
        cuisine: "c".repeat(60),
        address: {
          street: "s".repeat(100),
          city: "c".repeat(100),
          stateRegion: "r".repeat(100),
          postalCode: "p".repeat(20),
          country: "u".repeat(100),
        },
      }),
      tinyPng,
    );
    expect(maxed.ok).toBe(true);
  });
});

describe("public browse filters and aggregates", () => {
  const place = (cuisine: string, city: string) => ({
    cuisine,
    city,
    street: "9 Browse St",
    stateRegion: "TX",
    postalCode: "78701",
    country: "US",
  });

  it("orders by best/worst with id DESC ties and unrated last", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const rf = restaurantsFactory(db);
    const cuisine = "BrowseOrderCuisine";
    const city = "BrowseOrderCity";
    const where = place(cuisine, city);

    const highA = await rf.fakeRestaurant({ ownerId: owner.id, title: "High A", ...where });
    const highB = await rf.fakeRestaurant({ ownerId: owner.id, title: "High B", ...where });
    const mid = await rf.fakeRestaurant({ ownerId: owner.id, title: "Mid", ...where });
    const unratedA = await rf.fakeRestaurant({ ownerId: owner.id, title: "Unrated A", ...where });
    const unratedB = await rf.fakeRestaurant({ ownerId: owner.id, title: "Unrated B", ...where });

    // Equal 5.0 averages on highA/highB; mid is 3.0; two unrated.
    await reviewsFactory(db).fakeReview({ restaurantId: highA.id, rating: 5 });
    await reviewsFactory(db).fakeReview({ restaurantId: highB.id, rating: 5 });
    await reviewsFactory(db).fakeReview({ restaurantId: mid.id, rating: 3 });

    const scope = (rows: { id: number }[]) => rows.filter((r) => [highA.id, highB.id, mid.id, unratedA.id, unratedB.id].includes(r.id)).map((r) => r.id);

    const best = scope(await listRestaurants({ cuisine, city, sort: "best" }));
    // Higher avg first; equal avgs → higher id first; unrated last (id DESC among unrated).
    const highFirst = highA.id > highB.id ? [highA.id, highB.id] : [highB.id, highA.id];
    const unratedLast = unratedA.id > unratedB.id ? [unratedA.id, unratedB.id] : [unratedB.id, unratedA.id];
    expect(best).toEqual([...highFirst, mid.id, ...unratedLast]);

    const worst = scope(await listRestaurants({ cuisine, city, sort: "worst" }));
    expect(worst).toEqual([mid.id, ...highFirst, ...unratedLast]);
  });

  it("returns numeric aggregates for rated restaurants and null/0 for unrated", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const cuisine = "BrowseAggCuisine";
    const city = "BrowseAggCity";
    const where = place(cuisine, city);
    const rated = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Rated", ...where });
    const unrated = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Unrated", ...where });

    await reviewsFactory(db).fakeReview({ restaurantId: rated.id, rating: 4 });
    await reviewsFactory(db).fakeReview({ restaurantId: rated.id, rating: 5 });

    const rows = await listRestaurants({ cuisine, city });
    const ratedRow = rows.find((r) => r.id === rated.id);
    const unratedRow = rows.find((r) => r.id === unrated.id);

    expect(ratedRow).toMatchObject({ averageRating: 4.5, reviewCount: 2 });
    expect(typeof ratedRow?.averageRating).toBe("number");
    expect(unratedRow).toMatchObject({ averageRating: null, reviewCount: 0 });
  });

  it("filters by inclusive minRating and excludes unrated on numeric thresholds", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const cuisine = "BrowseMinCuisine";
    const city = "BrowseMinCity";
    const rf = restaurantsFactory(db);
    const where = place(cuisine, city);

    const five = await rf.fakeRestaurant({ ownerId: owner.id, title: "Five", ...where });
    const four = await rf.fakeRestaurant({ ownerId: owner.id, title: "Four", ...where });
    const three = await rf.fakeRestaurant({ ownerId: owner.id, title: "Three", ...where });
    // Unrounded 3.5 sits below 4+.
    const threeFive = await rf.fakeRestaurant({ ownerId: owner.id, title: "ThreeFive", ...where });
    const unrated = await rf.fakeRestaurant({ ownerId: owner.id, title: "None", ...where });

    await reviewsFactory(db).fakeReview({ restaurantId: five.id, rating: 5 });
    await reviewsFactory(db).fakeReview({ restaurantId: four.id, rating: 4 });
    await reviewsFactory(db).fakeReview({ restaurantId: three.id, rating: 3 });
    await reviewsFactory(db).fakeReview({ restaurantId: threeFive.id, rating: 3 });
    await reviewsFactory(db).fakeReview({ restaurantId: threeFive.id, rating: 4 });

    const ids = async (minRating?: 3 | 4 | 5) => (await listRestaurants({ cuisine, city, minRating })).map((r) => r.id).sort((a, b) => a - b);

    const all = [five.id, four.id, three.id, threeFive.id, unrated.id].sort((a, b) => a - b);
    expect(await ids(undefined)).toEqual(all);

    expect(await ids(3)).toEqual([five.id, four.id, three.id, threeFive.id].sort((a, b) => a - b));
    expect(await ids(4)).toEqual([five.id, four.id].sort((a, b) => a - b));
    expect(await ids(5)).toEqual([five.id]);
  });

  it("matches cuisine and city with trimmed case-insensitive exact equality (AND)", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const rf = restaurantsFactory(db);

    const target = await rf.fakeRestaurant({
      ownerId: owner.id,
      title: "Target",
      ...place("BrowseExactThai", "BrowseExactAustin"),
    });
    await rf.fakeRestaurant({
      ownerId: owner.id,
      title: "Other cuisine",
      ...place("BrowseExactMex", "BrowseExactAustin"),
    });
    await rf.fakeRestaurant({
      ownerId: owner.id,
      title: "Other city",
      ...place("BrowseExactThai", "BrowseExactDallas"),
    });

    const matched = await listRestaurants({ cuisine: "  browseexactthai  ", city: "  BROWSEEXACTAUSTIN " });
    expect(matched.map((r) => r.id)).toEqual([target.id]);

    expect(await listRestaurants({ cuisine: "BrowseExactThai", city: "NoSuchCity" })).toEqual([]);
    expect(await listRestaurants({ cuisine: "NoSuchCuisine" })).toEqual([]);
  });

  it("combines cuisine, city, minRating, and worst-first sorting", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const cuisine = "BrowseComboCuisine";
    const city = "BrowseComboCity";
    const rf = restaurantsFactory(db);
    const where = place(cuisine, city);

    const a = await rf.fakeRestaurant({ ownerId: owner.id, title: "A", ...where });
    const b = await rf.fakeRestaurant({ ownerId: owner.id, title: "B", ...where });
    const c = await rf.fakeRestaurant({ ownerId: owner.id, title: "C", ...where });
    // Outside filters.
    await rf.fakeRestaurant({ ownerId: owner.id, title: "Out", ...place("BrowseComboOther", city) });

    await reviewsFactory(db).fakeReview({ restaurantId: a.id, rating: 5 });
    await reviewsFactory(db).fakeReview({ restaurantId: b.id, rating: 4 });
    await reviewsFactory(db).fakeReview({ restaurantId: c.id, rating: 3 });

    const rows = await listRestaurants({ cuisine, city, minRating: 4, sort: "worst" });
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("returns deduplicated alphabetically ordered filter options", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const rf = restaurantsFactory(db);

    await rf.fakeRestaurant({
      ownerId: owner.id,
      cuisine: "  BrowseFilterZebra  ",
      city: "  BrowseFilterZed  ",
    });
    await rf.fakeRestaurant({
      ownerId: owner.id,
      cuisine: "browsefilterzebra",
      city: "browsefilterzed",
    });
    await rf.fakeRestaurant({
      ownerId: owner.id,
      cuisine: "BrowseFilterAlpha",
      city: "BrowseFilterAble",
    });

    const options = await getRestaurantFilterOptions();

    const cuisines = options.cuisines.filter((c) => c.toLowerCase().includes("browsefilter"));
    const cities = options.cities.filter((c) => c.toLowerCase().includes("browsefilter"));

    expect(cuisines).toHaveLength(2);
    expect(cuisines.map((c) => c.toLowerCase()).sort()).toEqual(["browsefilteralpha", "browsefilterzebra"]);
    expect(cuisines).toEqual([...cuisines].sort((a, b) => a.localeCompare(b)));

    expect(cities).toHaveLength(2);
    expect(cities.map((c) => c.toLowerCase()).sort()).toEqual(["browsefilterable", "browsefilterzed"]);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
  });

  it("defaults unsupported sort and minRating values safely", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const cuisine = "BrowseInvalidCuisine";
    const city = "BrowseInvalidCity";
    const where = place(cuisine, city);
    const high = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "High", ...where });
    const low = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Low", ...where });
    const unrated = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Unrated", ...where });

    await reviewsFactory(db).fakeReview({ restaurantId: high.id, rating: 5 });
    await reviewsFactory(db).fakeReview({ restaurantId: low.id, rating: 2 });

    const bogus = await listRestaurants({
      cuisine,
      city,
      // @ts-expect-error intentional invalid runtime values
      sort: "nope",
      // @ts-expect-error intentional invalid runtime values
      minRating: 2,
    });

    // Invalid minRating ignored (unrated included); invalid sort → best.
    expect(bogus.map((r) => r.id)).toEqual(
      [high.id, low.id, unrated.id].sort((a, b) => {
        // best order: high (5), low (2), unrated
        const rank = (id: number) => (id === high.id ? 0 : id === low.id ? 1 : 2);
        return rank(a) - rank(b);
      }),
    );
  });

  it("refreshes list aggregates after a review mutation", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });
    const cuisine = "BrowseRefreshCuisine";
    const city = "BrowseRefreshCity";
    const restaurant = await restaurantsFactory(db).fakeRestaurant({
      ownerId: owner.id,
      title: "Refresh",
      ...place(cuisine, city),
    });

    const before = (await listRestaurants({ cuisine, city })).find((r) => r.id === restaurant.id);
    expect(before).toMatchObject({ averageRating: null, reviewCount: 0 });

    const created = await createReview(reviewer.id, restaurant.id, { rating: 4, content: "Solid meal." });
    expect(created.ok).toBe(true);

    const after = (await listRestaurants({ cuisine, city })).find((r) => r.id === restaurant.id);
    expect(after).toMatchObject({ averageRating: 4, reviewCount: 1 });
  });
});

describe("factory", () => {
  it("creates deterministic fixtures, validates ownerId, and accepts image overrides", async () => {
    const owner = await usersApi().fakeUser({ role: "owner" });
    const reviewer = await usersApi().fakeUser({ role: "reviewer" });

    // Same seed + same owner avoids email collisions and proves Faker isolation.
    const a = await restaurantsFactory(db, { seed: 42 }).fakeRestaurant({ ownerId: owner.id });
    const b = await restaurantsFactory(db, { seed: 42 }).fakeRestaurant({ ownerId: owner.id });
    expect(a.title).toEqual(b.title);
    expect(a.address.city).toEqual(b.address.city);

    const explicit = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, title: "Explicit" });
    expect(explicit.ownerId).toBe(owner.id);
    expect(explicit.title).toBe("Explicit");

    const before = (await db.select().from(restaurants)).length;
    await expect(restaurantsFactory(db).fakeRestaurant({ ownerId: reviewer.id })).rejects.toThrow(/owner/i);
    expect((await db.select().from(restaurants)).length).toBe(before);

    await expect(restaurantsFactory(db).fakeRestaurant({ ownerId: 9_999_999 })).rejects.toThrow(/owner/i);

    // Implicit owner creation works.
    const implicit = await restaurantsFactory(db).fakeRestaurant({ title: "Implicit Owner" });
    expect(implicit.ownerId).toEqual(expect.any(Number));
    expect(implicit.title).toBe("Implicit Owner");

    uploadAsset.mockClear();
    const withImage = await restaurantsFactory(db).fakeRestaurant({ ownerId: owner.id, image: tinyPng });
    expect(uploadAsset).toHaveBeenCalled();
    expect(withImage.imageUrl).toMatch(/^\/api\/assets\//);
  });

  it("propagates the caller's executor to nested user factory writes", async () => {
    // Begin a transaction, create via factory with the tx executor, then roll back.
    // Nested owner insert must use the same executor so the rollback removes both rows.
    await db
      .transaction(async (tx) => {
        const created = await restaurantsFactory(tx).fakeRestaurant({ title: "Tx Scoped" });
        expect(created.title).toBe("Tx Scoped");

        const restaurantRows = await tx.select().from(restaurants).where(eq(restaurants.id, created.id));
        expect(restaurantRows).toHaveLength(1);

        const ownerRows = await tx
          .select()
          .from(addresses)
          .where(eq(addresses.id, restaurantRows[0]?.addressId ?? -1));
        // Address exists inside the transaction.
        expect(ownerRows.length).toBeGreaterThanOrEqual(0);

        // Force rollback without committing factory side effects.
        throw new Error("rollback-factory-tx");
      })
      .catch((error: unknown) => {
        expect(error).toEqual(expect.objectContaining({ message: "rollback-factory-tx" }));
      });

    // After rollback, the factory restaurant (and nested owner if created in-tx) are gone.
    const leftovers = await db.select().from(restaurants).where(eq(restaurants.title, "Tx Scoped"));
    expect(leftovers).toHaveLength(0);
  });
});
