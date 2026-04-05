/**
 * 在**已有 Markdown 文件**上套用 KB 行内碎片规则（{@link applyKbFragmentRulesToMarkdown}），默认 **dry-run**；
 * 显式传入 `--write` 时写回原路径（**不产生新文件**）。
 *
 * 用法:
 *   pnpm run pdf-kb-fragment-apply-inplace -- --file side-tools/pdf-text-cleanup/out/foo.kb.md
 *   pnpm run pdf-kb-fragment-apply-inplace -- --dir side-tools/pdf-text-cleanup/out --write
 *   pnpm run pdf-kb-fragment-apply-inplace -- --file foo.kb.md --write
 *
 * 安全：无 `--write` 时只打印是否变更与差异摘要，不修改磁盘。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { applyKbFragmentRulesToMarkdown } from "./mineru-kb.js";

function parseArgs(): {
  file?: string;
  dir?: string;
  write: boolean;
  globPat: string;
} {
  const argv = process.argv.slice(2);
  let file: string | undefined;
  let dir: string | undefined;
  let write = false;
  let globPat = "*.kb.md";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" && argv[i + 1]) file = resolve(process.cwd(), argv[++i]);
    else if (a === "--dir" && argv[i + 1]) dir = resolve(process.cwd(), argv[++i]);
    else if (a === "--write") write = true;
    else if (a === "--glob" && argv[i + 1]) globPat = argv[++i];
  }
  return { file, dir, write, globPat };
}

function matchGlob(filename: string, pattern: string): boolean {
  if (!pattern.includes("*")) return filename === pattern;
  const parts = pattern.split("*");
  if (parts.length !== 2) return filename.endsWith(pattern.replace("*", ""));
  const [pre, post] = parts;
  return filename.startsWith(pre) && filename.endsWith(post);
}

function summarizeChange(before: string, after: string): string {
  if (before === after) return "无变化";
  return `变更: ${before.length} → ${after.length} 字符`;
}

function processOne(path: string, write: boolean): boolean {
  const before = readFileSync(path, "utf-8");
  const after = applyKbFragmentRulesToMarkdown(before);
  const changed = before !== after;
  console.log(`${path}: ${summarizeChange(before, after)}`);
  if (changed && !write) {
    let diffLines = 0;
    const a = before.split("\n");
    const b = after.split("\n");
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++)
      if (a[i] !== b[i]) diffLines++;
    console.log(`  （约 ${diffLines} 行与结果不同；加 --write 写入）`);
  }
  if (write && changed) {
    writeFileSync(path, after, "utf-8");
    console.log(`  已写回`);
  }
  return changed;
}

function main(): void {
  const { file, dir, write, globPat } = parseArgs();
  if (!file && !dir) {
    console.error(
      "用法: pnpm run pdf-kb-fragment-apply-inplace -- --file <路径.md> [--write]\n" +
        "   或: pnpm run pdf-kb-fragment-apply-inplace -- --dir <目录> [--glob '*.kb.md'] [--write]\n" +
        "未加 --write 时为 dry-run，不修改文件。",
    );
    process.exit(1);
  }

  if (!write) {
    console.log("dry-run（未加 --write，不写入磁盘）\n");
  }

  let paths: string[] = [];
  if (file) paths = [file];
  else if (dir) {
    paths = readdirSync(dir)
      .filter((f) => matchGlob(f, globPat))
      .sort()
      .map((f) => join(dir, f));
  }

  let changedCount = 0;
  for (const p of paths) {
    if (processOne(p, write)) changedCount++;
  }
  console.log(`---\n处理 ${paths.length} 个文件，其中 ${changedCount} 个有内容变更。`);
  if (!write && changedCount > 0)
    console.log("若确认无误，追加 --write 写回原路径。");
}

main();
