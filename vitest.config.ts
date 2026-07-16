import { defineConfig } from "vitest/config";

const tailwindIntegrationTest = "src/server/tailwind-intelligence-official.integration.test.ts";

export default defineConfig({
  test: {
    // Bound ordinary test parallelism on laptops and smaller CI machines.
    // Compiler-heavy server tests use a smaller execution group below.
    maxWorkers: 4,
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts"],
          exclude: [tailwindIntegrationTest],
          // TypeScript component-index suites build real compiler programs.
          // Run them first with two workers; the UI group still gets four.
          // The normal five-second test timeout deliberately remains intact.
          maxWorkers: 2,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}", "examples/**/*.test.{ts,tsx}"],
          exclude: ["src/server/**/*.test.ts"],
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: "tailwind-integration",
          environment: "node",
          include: [tailwindIntegrationTest],
          fileParallelism: false,
          maxWorkers: 1,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
