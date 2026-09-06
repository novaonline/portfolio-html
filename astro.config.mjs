// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import { validatePublic } from "./scripts/editorial/validate-public.mjs";

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  integrations: [
    tailwind({
      configFile: "./tailwind.config.mjs",
    }),
    mdx(),
    {
      name: "validate-selected-content",
      hooks: {
        "astro:build:start": () => {
          validatePublic(process.cwd(), process.env.SITE_PREVIEW === "1");
        },
      },
    },
  ],
});
