import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

import type { AstroIntegration, AstroIntegrationLogger } from "astro";
import * as tar from "tar";
import { default as initAge } from "age-encryption";

type PixelArtIconsIntegrationConfig = {
  /** The path to the encrypted archive of icons */
  encryptedArchive: string;
  /** The decryption key to use for decrypting the archive */
  decryptionKey: string;
  /** The directory in which to place the unarchived icons */
  outDir: string;
};

export function pixelArtIcons({
  encryptedArchive,
  decryptionKey,
  outDir,
}: PixelArtIconsIntegrationConfig): AstroIntegration {
  const decryptAndUnpack = async ({
    logger,
  }: {
    logger: AstroIntegrationLogger;
  }): Promise<void> => {
    logger.debug(
      `Running Pixel Art Icons integration with configuration: ${JSON.stringify({ encryptedArchive, decryptionKey, outDir })}`
    );

    if (fs.existsSync(outDir)) {
      logger.info(
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
    name: "pixel icons",
    hooks: {
      "astro:build:start": decryptAndUnpack,
      "astro:server:start": decryptAndUnpack,
    },
  };
}
