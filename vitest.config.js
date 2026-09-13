import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{unit,known-bugs,integration}/**/*.test.js"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ["default"]
  }
});

