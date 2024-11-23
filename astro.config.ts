import path from "node:path";

import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

import pkg from "./package.json";
import { pixelArtIcons } from "./build/icons";
import { cfPagesEnvVars } from "./build/cloudflare";

const iconDir = path.resolve("icons");

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({ imageService: "cloudflare" }),
  integrations: [
    pixelArtIcons({
      outDir: iconDir,
      encryptedArchive: path.resolve("icons.tar.gz.enc"),
      decryptionKeyVar: "PIXEL_ART_ICONS_DECRYPTION_KEY",
    }),
    icon({ include: {}, iconDir }),
    cfPagesEnvVars(),
    sitemap(),
  ],
  env: {
    schema: {
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
    },
  },
});
