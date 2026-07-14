import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Keep the real Tailwind language server responsive while the UI and
    // server projects run together on laptops and smaller CI machines.
    maxWorkers: 4,
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}", "examples/**/*.test.{ts,tsx}"],
          exclude: ["src/server/**/*.test.ts"],
        },
      },
    ],
  },
});
