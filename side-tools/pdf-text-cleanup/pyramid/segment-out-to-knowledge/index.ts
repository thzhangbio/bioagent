import { pathToFileURL } from "node:url";

import {
  createSegmentOutToKnowledgeContext,
  markSegmentOutToKnowledgeStageComplete,
  type SegmentOutToKnowledgeContext,
  type SegmentOutToKnowledgeOptions,
  type SegmentOutToKnowledgeStage,
} from "./stage-shared.js";
import { segmentOutToKnowledge00PreOutCheckStage } from "./00-pre-out-check/index.js";
import { segmentOutToKnowledge01CopyToKnowledgeStage } from "./01-copy-to-knowledge/index.js";
import { segmentOutToKnowledge02MetadataIdStage } from "./02-metadata-id/index.js";
import { segmentOutToKnowledge03IngestIndexStage } from "./03-ingest-index/index.js";
import { segmentOutToKnowledge04VerifySearchStage } from "./04-verify-search/index.js";
import { segmentOutToKnowledge05MarkReadyArchiveStage } from "./05-mark-ready-archive/index.js";

export const segmentOutToKnowledgeStages: SegmentOutToKnowledgeStage[] = [
  segmentOutToKnowledge00PreOutCheckStage,
  segmentOutToKnowledge01CopyToKnowledgeStage,
  segmentOutToKnowledge02MetadataIdStage,
  segmentOutToKnowledge03IngestIndexStage,
  segmentOutToKnowledge04VerifySearchStage,
  segmentOutToKnowledge05MarkReadyArchiveStage,
];

export async function runSegmentOutToKnowledge(
  input: SegmentOutToKnowledgeContext | SegmentOutToKnowledgeOptions,
): Promise<SegmentOutToKnowledgeContext> {
  let context =
    "stageOrder" in input ? input : createSegmentOutToKnowledgeContext(input);

  for (const stage of segmentOutToKnowledgeStages) {
    context = await stage.run(context);
    context = markSegmentOutToKnowledgeStageComplete(context, stage.name);
  }

  return context;
}

function printHelp(): void {
  console.log("段Ⅱ总控：segment-out-to-knowledge");
  console.log(
    "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/segment-out-to-knowledge/index.ts [--out-dir <路径>] [--knowledge-dir <路径>] [--skip-copy] [--skip-ingest]",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    printHelp();
    return;
  }

  const context = await runSegmentOutToKnowledge({
    argv,
    cwd: process.cwd(),
    invokedFromCli: true,
  });

  console.log(`段Ⅱ已完成。处理文件数: ${context.outFiles.length}`);
  if (context.manifestPath) {
    console.log(`已标记可归档: ${context.manifestPath}`);
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
