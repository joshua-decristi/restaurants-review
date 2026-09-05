import type { Faker } from "@faker-js/faker";

import { credentialsSchema } from "@/lib/auth/credentials/server";
import { hashPassword } from "@/lib/auth/password/server";
import type { DbExecutor, FactoryOptions } from "@/lib/db/server";
import { createFaker } from "@/lib/db/server";

import type { Role } from "./roles";
import type { User } from "./schema";
import { users } from "./schema";
import { userNameSchema } from "./validation";

/**
 * Insert overrides plus the factory-only plaintext `password`.
 * `passwordHash` is omitted so callers cannot bypass hashing.
 */
export type FakeUserOverrides = Omit<Partial<typeof users.$inferInsert>, "passwordHash"> & {
  password?: string;
};

/** Builds persisted user values; explicit overrides beat Faker defaults. */
async function buildUserValues(faker: Faker, overrides: FakeUserOverrides = {}): Promise<typeof users.$inferInsert> {
  const { password: explicitPassword, email: explicitEmail, role: explicitRole, name: explicitName, ...rest } = overrides;

  // UUID local-part keeps concurrent test inserts collision-resistant.
  // Auth credentialsSchema normalizes email and enforces password minimum.
  const { email, password } = credentialsSchema.parse({
    email: explicitEmail ?? `${faker.string.uuid()}@example.com`,
    password: explicitPassword ?? faker.internet.password({ length: 16 }),
  });
  const passwordHash = await hashPassword(password);
  const role: Role = explicitRole ?? "reviewer";
  // Display name is required and stored trimmed (1–100). Registration is separate.
  const name = userNameSchema.parse(explicitName ?? faker.person.fullName());

  return { ...rest, email, passwordHash, role, name };
}

/**
 * Users-domain fixture factory. Returns inserted rows only — never plaintext
 * secrets. Callers that need a known password must pass it explicitly.
 */
export function usersFactory(executor: DbExecutor, factoryOptions: FactoryOptions = {}) {
  let fakerPromise: Promise<Faker> | undefined;

  const getFaker = (): Promise<Faker> => {
    fakerPromise ??= createFaker(factoryOptions.seed);
    return fakerPromise;
  };

  return {
    async fakeUser(overrides: FakeUserOverrides = {}): Promise<User> {
      const values = await buildUserValues(await getFaker(), overrides);
      const [row] = await executor.insert(users).values(values).returning();

      // Runtime guard: empty returning() would mean a driver/protocol failure.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive
      if (row === undefined) throw new Error("usersFactory.fakeUser: insert returned no row.");
      return row;
    },
  };
}
