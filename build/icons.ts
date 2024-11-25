import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import url from "node:url";

import type {
  AstroIntegration,
  AstroIntegrationLogger,
  InjectedType,
} from "astro";
import * as tar from "tar";
import { default as initAge } from "age-encryption";
import { envField } from "astro/config";
import icon from "astro-icon";

type PixelArtIconsIntegrationConfig = {
  /** The path to the age-encrypted gz-compressed tarball of icons */
  encryptedArchive: string;
  /** The environment variable containing the decryption key */
  decryptionKeyVar: string;
};

/**
 * Decrypt and extract halfmage's pixel art icons for use with the `astro-icon` library.
 */
export function pixelArtIcons({
  encryptedArchive,
  decryptionKeyVar,
}: PixelArtIconsIntegrationConfig): AstroIntegration {
  let iconDir: URL;

  return {
    name: "pixel icons",
    hooks: {
      "astro:config:setup": ({ updateConfig, createCodegenDir }) => {
        iconDir = new URL("icons", createCodegenDir());

        updateConfig({
          // Tell the `icon` integration to look for icons in the dir we're extracting to.
          integrations: [
            icon({
              include: {},
              iconDir: url.fileURLToPath(iconDir),
            }),
          ],

          // Require `decryptionKeyVar` to be set in the environment
          env: {
            schema: {
              [decryptionKeyVar]: envField.string({
                access: "secret",
                context: "server",
                optional: false,
              }),
            },
            validateSecrets: true,
          },
        });
      },
      "astro:config:done": async ({ logger, injectTypes }): Promise<void> => {
        const archivePath = path.resolve(encryptedArchive);
        if (!fs.existsSync(archivePath)) {
          logger.error(`${archivePath} not found`);
          return;
        }

        const decryptedArchive = await decrypt({
          encrypted: await fsp.readFile(archivePath),
          // We can assert this exists because we tell astro to validate it in the "config:setup" hook.
          key: process.env[decryptionKeyVar]!,
        });

        if (!fs.existsSync(iconDir)) {
          await fsp.mkdir(iconDir);
        }

        await extract({
          cwd: iconDir,
          logger,
          archive: decryptedArchive,
        });

        const dtsFileUrl = await createDts({
          injectTypes,
          iconDir,
        });

        logger.debug(`Wrote icon names to ${url.fileURLToPath(dtsFileUrl)}`);

        logger.info(`Successfully extracted icons`);

        return;
      },
    },
  };
}

async function extract({
  cwd,
  logger,
  archive,
}: {
  cwd: URL;
  logger: AstroIntegrationLogger;
  archive: Uint8Array;
}) {
  const extractor = tar.extract({ cwd: url.fileURLToPath(cwd) });

  extractor.on("warn", (err) => logger.warn(`${err}`));
  const doneWriting = new Promise<void>((resolve) =>
    extractor.on("close", resolve)
  );

  await new Promise<void>((resolve, reject) =>
    extractor.write(archive, (err) =>
      err instanceof Error ? reject(err) : resolve()
    )
  );

  await new Promise<void>((resolve) => extractor.end(resolve));
  await doneWriting;
}

async function decrypt({
  encrypted,
  key,
}: {
  encrypted: Uint8Array;
  key: string;
}) {
  const age = await initAge();
  const decryptor = new age.Decrypter();
  decryptor.addIdentity(key);

  return decryptor.decrypt(encrypted, "uint8array");
}

async function createDts({
  injectTypes,
  iconDir,
}: {
  injectTypes: (injectedType: InjectedType) => URL;
  iconDir: URL;
}) {
  const iconNames = (await fsp.readdir(iconDir, { withFileTypes: true })).map(
    (entry) => path.parse(entry.name).name
  );

  const iconNameTypeDecl = `export type IconName = ${iconNames.map((name) => `"${name}"`).join(" | ")};`;

  return injectTypes({
    filename: "icon-names.d.ts",
    content: `declare module "virtual:pixel-art-icons" { ${iconNameTypeDecl} }`,
  });
}
