import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentMatchGlobs: [["src/server/**/*.test.ts", "node"]],
    setupFiles: ["./src/test/setup.ts"],
  },
});
