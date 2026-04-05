/**
 * 兼容入口：转调 pyramid 段Ⅲ的 `out-only` 模式。
 */

import { runSegmentOutToArchive } from "./pyramid/segment-out-to-archive/index.js";

async function main(): Promise<void> {
  const context = await runSegmentOutToArchive({
    argv: ["--mode", "out-only", ...process.argv.slice(2)],
    cwd: process.cwd(),
    invokedFromCli: true,
    mode: "out-only",
  });
  console.log(`共 ${context.outTargets.length} 个文件 → ${context.outArchiveDest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
