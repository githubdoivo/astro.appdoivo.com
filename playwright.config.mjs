import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4179", trace: "retain-on-failure" },
  webServer: { command: "python3 -m http.server 4179", url: "http://localhost:4179", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
