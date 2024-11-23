import process from "node:process";

export function cfPagesBuildMetadata() {
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
