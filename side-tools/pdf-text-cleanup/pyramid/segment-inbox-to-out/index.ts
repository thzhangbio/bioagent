import { pathToFileURL } from "node:url";

import {
  createSegmentInboxToOutContext,
  markSegmentInboxToOutStageComplete,
  type SegmentInboxToOutContext,
  type SegmentInboxToOutOptions,
  type SegmentInboxToOutStage,
} from "./stage-shared.js";
import { segmentInboxToOut00EntryRoutingStage } from "./00-entry-routing/index.js";
import { segmentInboxToOut01ReadValidateStage } from "./01-read-validate/index.js";
import { segmentInboxToOut02StructureJsonStage } from "./02-structure-json/index.js";
import { segmentInboxToOut03MineruPreliminaryStage } from "./03-mineru-preliminary/index.js";
import { segmentInboxToOut04LayoutFlowStage } from "./04-layout-flow/index.js";
import { segmentInboxToOut05HeadersFootersPagesStage } from "./05-headers-footers-pages/index.js";
import { segmentInboxToOut06TablesBlocksStage } from "./06-tables-blocks/index.js";
import { segmentInboxToOut07CleanupGenericStage } from "./07-cleanup-generic/index.js";
import { segmentInboxToOut08CleanupKbSpecificStage } from "./08-cleanup-kb-specific/index.js";
import { segmentInboxToOut09FormulaFragmentsStage } from "./09-formula-fragments/index.js";
import { segmentInboxToOut10MetadataFetchStage } from "./10-metadata-fetch/index.js";
import { segmentInboxToOut11WriteFinalStage } from "./11-write-final/index.js";
import { segmentInboxToOut12InboxSyncStage } from "./12-inbox-sync/index.js";

export const segmentInboxToOutStages: SegmentInboxToOutStage[] = [
  segmentInboxToOut00EntryRoutingStage,
  segmentInboxToOut01ReadValidateStage,
  segmentInboxToOut02StructureJsonStage,
  segmentInboxToOut03MineruPreliminaryStage,
  segmentInboxToOut04LayoutFlowStage,
  segmentInboxToOut05HeadersFootersPagesStage,
  segmentInboxToOut06TablesBlocksStage,
  segmentInboxToOut07CleanupGenericStage,
  segmentInboxToOut08CleanupKbSpecificStage,
  segmentInboxToOut09FormulaFragmentsStage,
  segmentInboxToOut10MetadataFetchStage,
  segmentInboxToOut11WriteFinalStage,
  segmentInboxToOut12InboxSyncStage,
];

export async function runSegmentInboxToOut(
  input: SegmentInboxToOutContext | SegmentInboxToOutOptions,
): Promise<SegmentInboxToOutContext> {
  let context =
    "stageOrder" in input ? input : createSegmentInboxToOutContext(input);

  for (const stage of segmentInboxToOutStages) {
    context = await stage.run(context);
    context = markSegmentInboxToOutStageComplete(context, stage.name);
  }

  return context;
}

function printSegmentInboxToOutHelp(): void {
  console.log("段Ⅰ总控：segment-inbox-to-out");
  console.log(
    "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/segment-inbox-to-out/index.ts [--help]",
  );
  console.log("");
  console.log("当前阶段顺序:");
  for (const stage of segmentInboxToOutStages) {
    console.log(`- ${stage.name}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    printSegmentInboxToOutHelp();
    return;
  }

  const context = await runSegmentInboxToOut({
    argv,
    cwd: process.cwd(),
    invokedFromCli: true,
  });

  console.log("段Ⅰ总控已执行。");
  console.log(`已调度 ${context.completedStages.length} 个阶段。`);
  console.log(`阶段顺序: ${context.completedStages.join(" -> ")}`);
  if (context.primaryOutPath) {
    console.log(`主输出: ${context.primaryOutPath}`);
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
