import type { Faker } from "@faker-js/faker";

export interface FactoryOptions {
  /** Optional Faker seed for reproducible generated values. */
  seed?: number;
}

/** Creates an isolated Faker instance so factory seeds never touch global state. */
export async function createFaker(seed?: number): Promise<Faker> {
  const { Faker, en } = await import("@faker-js/faker");
  const faker = new Faker({ locale: [en] });
  if (seed !== undefined) faker.seed(seed);
  return faker;
}
