import process from "node:process";
import path from "node:path";
import fs from "node:fs";

import { defineConfig } from "astro/config";
import { type AstroIntegrationLogger, type AstroIntegration } from "astro";
import icon from "astro-icon";
import { execa } from "execa";

const iconDir = path.resolve("icons");
const iconArchive = path.resolve("icons.tar.gz.enc");
const iconDecryptionKey = process.env.PIXEL_ART_ICONS_DECRYPTION_KEY;

if (iconDecryptionKey === undefined) {
  throw new Error(
    `PIXEL_ART_ICONS_DECRYPTION_KEY is not set, cannot decrypt icons`
  );
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    pixelArtIcons({
      outDir: iconDir,
      encryptedArchive: iconArchive,
      decryptionKey: iconDecryptionKey,
    }),
    icon({ include: {}, iconDir }),
  ],
});

type PixelArtIconsIntegrationConfig = {
  encryptedArchive: string;
  decryptionKey: string;
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

    const { stderr, pipedFrom, stdout, exitCode } = await execa({
      input: decryptionKey,
    })`rage --decrypt --identity - ${archivePath}`.pipe`tar -xf -`;

    if (stderr.length > 0) {
      logger.warn(`stderr: ${stderr}`);
    }

    const decryptionStderr = pipedFrom[0]?.stderr;
    if (decryptionStderr !== undefined && decryptionStderr.length > 0) {
      logger.warn(`stderr: ${decryptionStderr}`);
    }

    if (exitCode !== 0) {
      logger.error(
        `Nonzero exit code from subprocess: ${exitCode}. Check stderr.`
      );
    }

    logger.debug(stdout);
  };

  return {
    name: "Pixel Art Icons",
    hooks: {
      "astro:build:start": decryptAndUnpack,
      "astro:server:start": decryptAndUnpack,
    },
  };
}
