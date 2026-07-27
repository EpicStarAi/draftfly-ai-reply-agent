import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:80",
    headless: true,
  },
  // No tsconfig here — e2e specs only use @playwright/test and Node built-ins,
  // so the default transpiler handles them without the workspace tsconfig.
});
