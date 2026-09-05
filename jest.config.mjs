import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/**
 * Auth.js ESM (`next-auth/jwt`) needs Node's `--experimental-vm-modules` to
 * load under Jest (see package.json `test` script); without it, loading fails
 * with "Must use import to load ES Module".
 * - The matching ExperimentalWarning is suppressed in
 *   `jest.suppress-vm-modules-warning.cjs` only, so other warnings stay visible.
 *
 * All unit and integration tests share this config and run serially via
 * `pnpm test` (`--runInBand`) so database resets cannot race.
 *
 * @type {import("jest").Config}
 */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Prefer @parcel/watcher over any locally installed watchman binary so
  // test behavior does not depend on host tooling.
  watchman: false,
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  // Resolve the `@/*` path alias for modules loaded under jest (e.g. the
  // users-domain server boundary, which imports `@/lib/*` modules).
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
};

export default createJestConfig(config);
