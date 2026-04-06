import { pathToFileURL } from "node:url";

import {
  createWechatCleanupContext,
  markWechatCleanupStageComplete,
  type WechatCleanupContext,
  type WechatCleanupOptions,
  type WechatCleanupStage,
} from "./stage-shared.js";
import { segmentInboxToOutStage } from "./segment-inbox-to-out/segment-inbox-to-out.js";
import { segmentLinksToInboxStage } from "./segment-links-to-inbox/segment-links-to-inbox.js";
import { segmentOutToArchiveStage } from "./segment-out-to-archive/segment-out-to-archive.js";
import { segmentOutToKnowledgeStage } from "./segment-out-to-knowledge/segment-out-to-knowledge.js";

export const wechatCleanupStages: WechatCleanupStage[] = [
  segmentLinksToInboxStage,
  segmentInboxToOutStage,
  segmentOutToKnowledgeStage,
  segmentOutToArchiveStage,
];

export async function runWechatArticleCleanup(
  input: WechatCleanupContext | WechatCleanupOptions,
): Promise<WechatCleanupContext> {
  let context =
    "stageOrder" in input ? input : createWechatCleanupContext(input);

  for (const stage of wechatCleanupStages) {
    context = await stage.run(context);
    context = markWechatCleanupStageComplete(context, stage.name);
  }

  return context;
}

function printHelp(): void {
  console.log("微信公众号清洗总控：wechat-article-cleanup");
  console.log(
    "用法: pnpm run wechat-article-pipeline [-- --fetch-only|--clean-only|--strip-footer|--fetch-stats|--no-liangyi-skip]",
  );
}

async function main(): Promise<void> {
  const argv0 = process.argv.slice(2);
  const argv = argv0[0] === "--" ? argv0.slice(1) : argv0;
  if (argv.includes("--help")) {
    printHelp();
    return;
  }
  const fetchOnly = argv.includes("--fetch-only");
  const cleanOnly = argv.includes("--clean-only");
  const stripFooter = argv.includes("--strip-footer");
  const fetchStats = argv.includes("--fetch-stats");
  const deferLiangyi = !argv.includes("--no-liangyi-skip");
  const context = await runWechatArticleCleanup({
    argv,
    cwd: process.cwd(),
    fetchOnly,
    cleanOnly,
    stripFooter,
    fetchStats,
    deferLiangyi,
    skipKnowledge: true,
    skipArchive: true,
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
