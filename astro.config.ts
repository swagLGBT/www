import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

import { defineConfig, envField } from "astro/config";
import { type AstroIntegrationLogger, type AstroIntegration } from "astro";
import cloudflare from "@astrojs/cloudflare";
import icon from "astro-icon";

import * as tar from "tar";
import { default as initAge } from "age-encryption";

import pkg from "./package.json";

const iconDir = path.resolve("icons");
const iconArchive = path.resolve("icons.tar.gz.enc");
const iconDecryptionKey = process.env.PIXEL_ART_ICONS_DECRYPTION_KEY;

if (iconDecryptionKey === undefined) {
  throw new Error(
    `PIXEL_ART_ICONS_DECRYPTION_KEY is not set, cannot decrypt icons`
  );
}

const pagesMeta = getCfPagesBuildMetadata();

// https://astro.build/config
export default defineConfig({
  ...(pagesMeta ? { site: pagesMeta.CF_PAGES_URL } : {}),
  // TODO: change this to "static" once @astrojs/cloudflare catches up to astro 5
  output: "server",
  adapter: cloudflare({ imageService: "cloudflare" }),
  compressHTML: false,
  integrations: [
    pixelArtIcons({
      outDir: iconDir,
      encryptedArchive: iconArchive,
      decryptionKey: iconDecryptionKey,
    }),
    icon({ include: {}, iconDir }),
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

      // Variables I use to decrypt my icons
      PIXEL_ART_ICONS_DECRYPTION_KEY: envField.string({
        access: "secret",
        context: "server",
        optional: false,
      }),
    },
    validateSecrets: true,
  },
});

type PixelArtIconsIntegrationConfig = {
  /** The path to the encrypted archive of icons */
  encryptedArchive: string;
  /** The decryption key to use for decrypting the archive */
  decryptionKey: string;
  /** The directory in which to place the unarchived icons */
  outDir: string;
};

function pixelArtIcons({
  encryptedArchive,
  decryptionKey,
  outDir,
}: PixelArtIconsIntegrationConfig): AstroIntegration {
  const decryptAndUnpack = async ({
    logger,
  }: {
    logger: AstroIntegrationLogger;
  }): Promise<void> => {
    if (decryptionKey === undefined) {
      logger.error(
        `Missing decryption key; is PIXEL_ART_ICONS_DECRYPTION_KEY set?`
      );
      return;
    }

    logger.debug(
      `Running Pixel Art Icons integration with configuration: ${JSON.stringify({ encryptedArchive, decryptionKey, outDir })}`
    );

    if (fs.existsSync(outDir)) {
      logger.warn(
        `Skipping extraction of icons since ${outDir} already exists.`
      );
      return;
    }

    const archivePath = path.resolve(encryptedArchive);
    if (!fs.existsSync(archivePath)) {
      logger.error(`${archivePath} not found`);
      return;
    }

    const archiveContents = await fsp.readFile(archivePath);

    const age = await initAge();
    const decryptor = new age.Decrypter();
    decryptor.addIdentity(decryptionKey);

    const decryptedArchive = decryptor.decrypt(archiveContents, "uint8array");

    const extractor = tar.extract();
    extractor.on("warn", (err) => logger.warn(`${err}`));
    const doneWriting = new Promise<void>((resolve) =>
      extractor.on("close", resolve)
    );

    await new Promise<void>((resolve, reject) =>
      extractor.write(decryptedArchive, (err) =>
        err instanceof Error ? reject(err) : resolve()
      )
    );

    await new Promise<void>((resolve) => extractor.end(resolve));
    await doneWriting;
    logger.info("Extracted icons from archive.");

    return;
  };

  return {
    name: "Pixel Art Icons",
    hooks: {
      "astro:build:start": decryptAndUnpack,
      "astro:server:start": decryptAndUnpack,
    },
  };
}

function getCfPagesBuildMetadata() {
  const { CF_PAGES, CF_PAGES_COMMIT_SHA, CF_PAGES_BRANCH, CF_PAGES_URL } =
    process.env;

  switch (CF_PAGES) {
    case undefined:
      return;
    case "1":
      break;
    default:
      throw new Error(`CF_PAGES was set to unexpected value: ${CF_PAGES}`);
  }

  if (CF_PAGES_COMMIT_SHA === undefined || CF_PAGES_COMMIT_SHA.length === 0) {
    throw new Error(`CF_PAGES was set, but CF_PAGES_COMMIT_SHA is undefined`);
  }

  if (CF_PAGES_BRANCH === undefined || CF_PAGES_BRANCH.length === 0) {
    throw new Error(`CF_PAGES was set, but CF_PAGES_BRANCH is undefined`);
  }

  if (CF_PAGES_URL === undefined || CF_PAGES_URL.length === 0) {
    throw new Error(`CF_PAGES was set, but CF_PAGES_URL is undefined`);
  }

  return { CF_PAGES_COMMIT_SHA, CF_PAGES_BRANCH, CF_PAGES_URL };
}
