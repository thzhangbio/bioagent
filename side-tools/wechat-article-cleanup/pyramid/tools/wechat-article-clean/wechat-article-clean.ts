import { pathToFileURL } from "node:url";

import { runWechatArticleCleanup } from "../../wechat-article-cleanup.js";

function printHelp(): void {
  console.log(
    "用法: pnpm run wechat-article-clean -- <inbox/xxx.raw.html> [--strip-footer] [--fetch-stats]",
  );
}

async function main(): Promise<void> {
  const argv0 = process.argv.slice(2);
  const argv = argv0[0] === "--" ? argv0.slice(1) : argv0;
  if (argv.includes("--help")) {
    printHelp();
    return;
  }
  const stripFooter = argv.includes("--strip-footer");
  const fetchStats = argv.includes("--fetch-stats");
  const positional = argv.filter(
    (a) => a !== "--strip-footer" && a !== "--fetch-stats",
  );
  const inputFile = positional[0];
  if (!inputFile) {
    throw new Error(
      "用法: pnpm run wechat-article-clean -- <inbox/xxx.raw.html> [--strip-footer] [--fetch-stats]",
    );
  }

  const context = await runWechatArticleCleanup({
    argv,
    cwd: process.cwd(),
    cleanOnly: true,
    stripFooter,
    fetchStats,
    deferLiangyi: false,
    skipKnowledge: true,
    skipArchive: true,
    inputFile,
  });

  for (const note of context.notes) {
    console.log(note);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
