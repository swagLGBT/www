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
  /** The path to the encrypted archive of icons */
  encryptedArchive: string;
  /** The environment variable containing the decryption key */
  decryptionKeyVar: string;
};

export function pixelArtIcons({
  encryptedArchive,
  decryptionKeyVar,
}: PixelArtIconsIntegrationConfig): AstroIntegration {
  const codegenDir: { value?: URL } = {};
  const iconDir: { value?: URL } = {};
  const extractedFolderName = "icons";

  return {
    name: "pixel icons",
    hooks: {
      "astro:config:setup": ({ updateConfig, createCodegenDir }) => {
        codegenDir.value = createCodegenDir();
        iconDir.value = url.pathToFileURL(
          path.join(url.fileURLToPath(codegenDir.value), extractedFolderName)
        );

        updateConfig({
          // Tell the `icon` integration to look for icons in the dir we're extracting to.
          integrations: [
            icon({
              include: {},
              iconDir: url.fileURLToPath(iconDir.value),
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

        if (codegenDir.value === undefined || iconDir.value === undefined) {
          throw new Error(
            "Expected codegen directories to be created by setup hook."
          );
        }

        const decryptedArchive = await decrypt({
          encrypted: await fsp.readFile(archivePath),
          // We can assert this exists because we tell astro to validate it in the "config:setup" hook.
          key: process.env[decryptionKeyVar]!,
        });

        await extract({
          cwd: codegenDir.value,
          logger,
          archive: decryptedArchive,
        });

        if (!fs.existsSync(iconDir.value)) {
          throw new Error(
            `Expected a folder named ${extractedFolderName} to exist after extraction.`
          );
        }

        const dtsFileUrl = await createDts({
          injectTypes,
          iconDir: iconDir.value,
        });

        logger.debug(`Wrote icon names to ${url.fileURLToPath(dtsFileUrl)}`);

        logger.info(`Extracted icons successfully`);

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
