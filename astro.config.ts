import process from "node:process";
import path from "node:path";

import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

import pkg from "./package.json";
import { pixelArtIcons } from "./build/icons";
import { cfPagesBuildMetadata } from "./build/cloudflare";

const { PIXEL_ART_ICONS_DECRYPTION_KEY } = process.env;
if (PIXEL_ART_ICONS_DECRYPTION_KEY === undefined) {
  throw new Error("PIXEL_ART_ICONS_DECRYPTION_KEY is not set.");
}

const iconDir = path.resolve("icons");
const pagesMeta = cfPagesBuildMetadata();
const site = pagesMeta ? { site: pagesMeta.CF_PAGES_URL } : {};

// https://astro.build/config
export default defineConfig({
  ...site,
  // TODO: change this to "static" once @astrojs/cloudflare catches up to astro 5
  output: "server",
  adapter: cloudflare({ imageService: "cloudflare" }),
  integrations: [
    pixelArtIcons({
      outDir: iconDir,
      encryptedArchive: path.resolve("icons.tar.gz.enc"),
      decryptionKey: PIXEL_ART_ICONS_DECRYPTION_KEY,
    }),
    icon({ include: {}, iconDir }),
    sitemap(),
  ],
  env: {
    schema: {
      // Variables set by the Cloudflare Pages build system
      CF_PAGES: envField.number({
        access: "public",
        context: "client",
        default: 0,
        optional: true,
      }),
      CF_PAGES_COMMIT_SHA: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      CF_PAGES_BRANCH: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      CF_PAGES_URL: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),

      // Variables I set in the cloudflare pages build system
      NODE_VERSION: envField.string({
        access: "public",
        context: "client",
        default: pkg.volta.node,
      }),
      NPM_VERSION: envField.string({
        access: "public",
        context: "client",
        default: pkg.volta.npm,
      }),

      // Needed to decrypt pixel icons
      PIXEL_ART_ICONS_DECRYPTION_KEY: envField.string({
        access: "secret",
        context: "server",
        optional: false,
      }),
    },
    validateSecrets: true,
  },
});
