import process from "node:process";

import type { AstroIntegration } from "astro";
import { envField } from "astro/config";

export function cfPagesEnvVars(): AstroIntegration {
  return {
    name: "cloudflare pages vars",
    hooks: {
      "astro:config:setup": ({ updateConfig, logger }) => {
        updateConfig({
          // TODO: change this to "static" once @astrojs/cloudflare catches up to astro 5
          output: "server",
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
            },
          },
        });

        const { CF_PAGES, CF_PAGES_COMMIT_SHA, CF_PAGES_BRANCH, CF_PAGES_URL } =
          process.env;

        switch (CF_PAGES) {
          case undefined:
            logger.warn("Not setting `site` since CF_PAGES is unset.");
            return;
          case "1":
            break;
          default:
            throw new Error(
              `CF_PAGES was set to unexpected value: ${CF_PAGES}`
            );
        }

        if (
          CF_PAGES_COMMIT_SHA === undefined ||
          CF_PAGES_COMMIT_SHA.length === 0
        ) {
          throw new Error(
            `CF_PAGES was set, but CF_PAGES_COMMIT_SHA is undefined`
          );
        }

        if (CF_PAGES_BRANCH === undefined || CF_PAGES_BRANCH.length === 0) {
          throw new Error(`CF_PAGES was set, but CF_PAGES_BRANCH is undefined`);
        }

        if (CF_PAGES_URL === undefined || CF_PAGES_URL.length === 0) {
          throw new Error(`CF_PAGES was set, but CF_PAGES_URL is undefined`);
        }

        updateConfig({ site: CF_PAGES_URL });

        logger.info(`set site url to ${CF_PAGES_URL} (via CF_PAGES_URL)`);
      },
    },
  };
}
