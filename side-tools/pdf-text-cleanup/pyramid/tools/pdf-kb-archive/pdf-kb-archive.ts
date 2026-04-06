import { pathToFileURL } from "node:url";

import { runSegmentOutToArchive } from "../../segment-out-to-archive/segment-out-to-archive.js";

function printHelp(): void {
  console.log("pdf-kb-archive");
  console.log("");
  console.log("含义：把 pdf-text-cleanup 当前可归档内容全部归档。");
  console.log("- 当前 out/*.kb.md -> archive/ingested-out/<时间戳>/");
  console.log("- 当前 inbox/*.md 与 inbox/*.json -> archive/processed-mineru/<时间戳>/");
  console.log("- README、审计报告、非 .kb.md 文件不会被移动。");
  console.log("- 会写 archive/audit-log/<时间戳>.json。");
  console.log("");
  console.log(
    "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/tools/pdf-kb-archive/pdf-kb-archive.ts [--force]",
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
    mode: "all",
    outSelection: "current-only",
  });

  console.log("pdf-kb-archive 已完成。");
  console.log(`已归档 out 文件 ${context.outTargets.length} 个。`);
  console.log(`已归档 inbox 文件 ${context.inboxTargets.length} 个。`);
  if (context.auditLogPath) {
    console.log(`审计日志: ${context.auditLogPath}`);
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
