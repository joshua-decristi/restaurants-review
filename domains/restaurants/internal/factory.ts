import "server-only";

import type { Faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { users, usersFactory } from "@/domains/users/server";
import { uploadAsset } from "@/lib/assets/server";
import type { DbExecutor, FactoryOptions } from "@/lib/db/server";
import { createFaker } from "@/lib/db/server";

import { toRestaurantView } from "./queries";
import { addresses, restaurants } from "./schema";
import type { RestaurantView } from "./validation";

/** 1×1 PNG — valid image fixture when callers omit `image`. */
const TINY_PNG_BYTES = Uint8Array.of(
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

function tinyPngFile(): File {
  return new File([TINY_PNG_BYTES], "factory.png", { type: "image/png" });
}

export interface FakeRestaurantOverrides {
  ownerId?: number;
  title?: string;
  description?: string;
  cuisine?: string;
  street?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  /** Optional insert timestamps; omitted values use DB defaults. */
  createdAt?: Date;
  updatedAt?: Date;
  addressCreatedAt?: Date;
  addressUpdatedAt?: Date;
  /** Factory-only image; uploaded through lib/assets when provided. */
  image?: File;
}

/**
 * Restaurants-domain fixture factory. Preserves owner role invariant and always
 * creates a paired address. Nested user creation uses the caller's executor.
 */
export function restaurantsFactory(executor: DbExecutor, factoryOptions: FactoryOptions = {}) {
  let fakerPromise: Promise<Faker> | undefined;

  const getFaker = (): Promise<Faker> => {
    fakerPromise ??= createFaker(factoryOptions.seed);
    return fakerPromise;
  };

  return {
    async fakeRestaurant(overrides: FakeRestaurantOverrides = {}): Promise<RestaurantView> {
      const faker = await getFaker();

      let ownerId = overrides.ownerId;
      if (ownerId === undefined) {
        const owner = await usersFactory(executor, factoryOptions).fakeUser({ role: "owner" });
        ownerId = owner.id;
      } else {
        const owner = (await executor.select().from(users).where(eq(users.id, ownerId)).limit(1)).at(0);
        if (owner?.role !== "owner") {
          throw new Error("restaurantsFactory.fakeRestaurant: ownerId must reference an existing owner user");
        }
      }

      const addressValues = {
        street: overrides.street ?? faker.location.streetAddress(),
        city: overrides.city ?? faker.location.city(),
        stateRegion: overrides.stateRegion ?? faker.location.state({ abbreviated: true }),
        postalCode: overrides.postalCode ?? faker.location.zipCode(),
        country: overrides.country ?? "US",
        ...(overrides.addressCreatedAt !== undefined ? { createdAt: overrides.addressCreatedAt } : {}),
        ...(overrides.addressUpdatedAt !== undefined ? { updatedAt: overrides.addressUpdatedAt } : {}),
      };

      const address = (await executor.insert(addresses).values(addressValues).returning()).at(0);
      if (address === undefined) throw new Error("restaurantsFactory.fakeRestaurant: address insert returned no row");

      const image = overrides.image ?? tinyPngFile();
      const imageKey = await uploadAsset(image);

      const restaurantValues = {
        ownerId,
        addressId: address.id,
        title: overrides.title ?? faker.company.name(),
        description: overrides.description ?? faker.lorem.paragraph(),
        cuisine: overrides.cuisine ?? faker.helpers.arrayElement(["Italian", "Japanese", "Mexican", "American", "Thai"]),
        imageKey,
        ...(overrides.createdAt !== undefined ? { createdAt: overrides.createdAt } : {}),
        ...(overrides.updatedAt !== undefined ? { updatedAt: overrides.updatedAt } : {}),
      };

      const restaurant = (await executor.insert(restaurants).values(restaurantValues).returning()).at(0);
      if (restaurant === undefined) throw new Error("restaurantsFactory.fakeRestaurant: restaurant insert returned no row");

      return toRestaurantView({
        id: restaurant.id,
        ownerId: restaurant.ownerId,
        title: restaurant.title,
        description: restaurant.description,
        cuisine: restaurant.cuisine,
        imageKey,
        street: address.street,
        city: address.city,
        stateRegion: address.stateRegion,
        postalCode: address.postalCode,
        country: address.country,
      });
    },
  };
}
