import fs from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  outputDir: ".work/browser-results",
  use: {
    baseURL: process.env.PREVIEW_URL ?? "http://127.0.0.1:4322",
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ??
        (fs.existsSync("/usr/bin/google-chrome")
          ? "/usr/bin/google-chrome"
          : undefined),
    },
    colorScheme: "light",
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.PREVIEW_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4322",
        url: "http://127.0.0.1:4322",
        reuseExistingServer: !process.env.CI,
      },
});
