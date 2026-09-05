import "server-only";

import type { Faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { restaurantsFactory } from "@/domains/restaurants/server";
import { users, usersFactory } from "@/domains/users/server";
import type { DbExecutor, FactoryOptions } from "@/lib/db/server";
import { createFaker } from "@/lib/db/server";

import { toReviewView } from "./queries";
import { reviews } from "./schema";
import type { ReviewRating, ReviewView } from "./validation";

export interface FakeReviewOverrides {
  restaurantId?: number;
  reviewerId?: number;
  rating?: ReviewRating;
  content?: string;
  /** Optional insert timestamps; omitted values use DB defaults. */
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Reviews-domain fixture factory. Preserves reviewer role invariant. Nested
 * restaurant/user creation uses the caller's executor (acyclic: reviews →
 * restaurants → users, reviews → users).
 */
export function reviewsFactory(executor: DbExecutor, factoryOptions: FactoryOptions = {}) {
  let fakerPromise: Promise<Faker> | undefined;

  const getFaker = (): Promise<Faker> => {
    fakerPromise ??= createFaker(factoryOptions.seed);
    return fakerPromise;
  };

  return {
    async fakeReview(overrides: FakeReviewOverrides = {}): Promise<ReviewView> {
      const faker = await getFaker();

      let restaurantId = overrides.restaurantId;
      if (restaurantId === undefined) {
        const restaurant = await restaurantsFactory(executor, factoryOptions).fakeRestaurant();
        restaurantId = restaurant.id;
      }

      let reviewerId = overrides.reviewerId;
      let reviewerName: string | undefined;
      if (reviewerId === undefined) {
        const reviewer = await usersFactory(executor, factoryOptions).fakeUser({ role: "reviewer" });
        reviewerId = reviewer.id;
        reviewerName = reviewer.name;
      } else {
        const reviewer = (await executor.select().from(users).where(eq(users.id, reviewerId)).limit(1)).at(0);
        if (reviewer?.role !== "reviewer") {
          throw new Error("reviewsFactory.fakeReview: reviewerId must reference an existing reviewer user");
        }
        reviewerName = reviewer.name;
      }

      const rating = overrides.rating ?? faker.number.int({ min: 1, max: 5 });
      const content = overrides.content ?? faker.lorem.paragraph();

      const values = {
        restaurantId,
        reviewerId,
        rating,
        content,
        ...(overrides.createdAt !== undefined ? { createdAt: overrides.createdAt } : {}),
        ...(overrides.updatedAt !== undefined ? { updatedAt: overrides.updatedAt } : {}),
      };

      const review = (await executor.insert(reviews).values(values).returning()).at(0);
      if (review === undefined) throw new Error("reviewsFactory.fakeReview: insert returned no row");

      return toReviewView({
        id: review.id,
        restaurantId: review.restaurantId,
        reviewerId: review.reviewerId,
        reviewerName,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      });
    },
  };
}
