import { pathToFileURL } from "node:url";

import {
  createKnowledgeImporterContext,
  markKnowledgeImporterStageComplete,
  type KnowledgeImporterContext,
  type KnowledgeImporterOptions,
  type KnowledgeImporterStage,
} from "./stage-shared.js";
import { segmentChunksToStoreStage } from "./segment-chunks-to-store/segment-chunks-to-store.js";
import { segmentLoadToNormalizedStage } from "./segment-load-to-normalized/segment-load-to-normalized.js";
import { segmentNormalizedToChunksStage } from "./segment-normalized-to-chunks/segment-normalized-to-chunks.js";

export const knowledgeImporterStages: KnowledgeImporterStage[] = [
  segmentLoadToNormalizedStage,
  segmentNormalizedToChunksStage,
  segmentChunksToStoreStage,
];

export async function runKnowledgeImporter(
  input: KnowledgeImporterContext | KnowledgeImporterOptions,
): Promise<KnowledgeImporterContext> {
  let context =
    "stageOrder" in input ? input : createKnowledgeImporterContext(input);

  for (const stage of knowledgeImporterStages) {
    context = await stage.run(context);
    context = markKnowledgeImporterStageComplete(context, stage.name);
  }

  return context;
}

function printHelp(): void {
  console.log("知识库导入器总控：knowledge-importer");
  console.log(
    "用法: pnpm run knowledge-import -- run --source <literature_kb|wechat_style> [--input <路径>]",
  );
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes("--help")) {
    printHelp();
    return;
  }

  throw new Error(
    "请通过 CLI 入口运行：pnpm run knowledge-import -- run --source <...>",
  );
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
