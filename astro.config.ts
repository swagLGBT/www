import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

import { defineConfig } from "astro/config";
import { type AstroIntegrationLogger, type AstroIntegration } from "astro";
import icon from "astro-icon";
import * as tar from "tar";
import { default as initAge } from "age-encryption";

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
