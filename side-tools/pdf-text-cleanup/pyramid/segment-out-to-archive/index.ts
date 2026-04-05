import { pathToFileURL } from "node:url";

import {
  createSegmentOutToArchiveContext,
  markSegmentOutToArchiveStageComplete,
  type SegmentOutToArchiveContext,
  type SegmentOutToArchiveOptions,
  type SegmentOutToArchiveStage,
} from "./stage-shared.js";
import { segmentOutToArchive00ArchiveTriggerStage } from "./00-archive-trigger/index.js";
import { segmentOutToArchive01TargetPathsStage } from "./01-target-paths/index.js";
import { segmentOutToArchive02IdempotencyStage } from "./02-idempotency/index.js";
import { segmentOutToArchive03MoveExecuteStage } from "./03-move-execute/index.js";
import { segmentOutToArchive04InboxArchiveSidecarStage } from "./04-inbox-archive-sidecar/index.js";
import { segmentOutToArchive05AuditLogStage } from "./05-audit-log/index.js";

export const segmentOutToArchiveStages: SegmentOutToArchiveStage[] = [
  segmentOutToArchive00ArchiveTriggerStage,
  segmentOutToArchive01TargetPathsStage,
  segmentOutToArchive02IdempotencyStage,
  segmentOutToArchive03MoveExecuteStage,
  segmentOutToArchive04InboxArchiveSidecarStage,
  segmentOutToArchive05AuditLogStage,
];

export async function runSegmentOutToArchive(
  input: SegmentOutToArchiveContext | SegmentOutToArchiveOptions,
): Promise<SegmentOutToArchiveContext> {
  let context =
    "stageOrder" in input ? input : createSegmentOutToArchiveContext(input);

  for (const stage of segmentOutToArchiveStages) {
    context = await stage.run(context);
    context = markSegmentOutToArchiveStageComplete(context, stage.name);
  }

  return context;
}

function printHelp(): void {
  console.log("段Ⅲ总控：segment-out-to-archive");
  console.log(
    "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/segment-out-to-archive/index.ts [--mode all|out-only|inbox-only] [--force]",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    printHelp();
    return;
  }

  const context = await runSegmentOutToArchive({
    argv,
    cwd: process.cwd(),
    invokedFromCli: true,
  });
  console.log(
    `段Ⅲ已完成。归档 out 文件 ${context.outTargets.length} 个，inbox 文件 ${context.inboxTargets.length} 个。`,
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
