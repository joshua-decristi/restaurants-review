import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Prefer @parcel/watcher over any locally installed watchman binary so
  // test behavior does not depend on host tooling.
  watchman: false,
};

export default createJestConfig(config);
