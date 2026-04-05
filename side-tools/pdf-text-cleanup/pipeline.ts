/**
 * 兼容入口：转调 pyramid 段Ⅰ总控。
 *
 * 旧用法保持不变：
 *   pnpm exec tsx side-tools/pdf-text-cleanup/pipeline.ts --raw-md <原始.md> [--json <结构化.json>] [--out <输出.md>]
 *
 * 实际实现已迁入：
 *   side-tools/pdf-text-cleanup/pyramid/segment-inbox-to-out/index.ts
 */

import { runSegmentInboxToOut } from "./pyramid/segment-inbox-to-out/index.js";

async function main(): Promise<void> {
  const context = await runSegmentInboxToOut({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    invokedFromCli: true,
  });

  console.log(`已写入: ${context.primaryOutPath}`);
  console.log(`约 ${(context.finalMd ?? "").length} 字符`);

  if (context.simpleOutPath) {
    console.log(`已写入（简名，便于固定路径）: ${context.simpleOutPath}`);
  }

  if (context.renamedInboxPaths.length > 0) {
    for (const renamed of context.renamedInboxPaths) {
      console.log(`inbox 已对齐: ${renamed}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
