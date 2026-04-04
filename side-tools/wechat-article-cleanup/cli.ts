/**
 * 清洗单份 inbox 原始文件 → out/
 *
 * 用法:
 *   pnpm exec tsx side-tools/wechat-article-cleanup/cli.ts inbox/某篇.raw.html [--strip-footer]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanWeChatArticleRaw } from "./clean-article.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function main(): void {
  const argv = process.argv.slice(2);
  const stripFooter = argv.includes("--strip-footer");
  const positional = argv.filter((a) => a !== "--strip-footer");
  const arg = positional[0];
  if (!arg) {
    console.error(
      "用法: pnpm exec tsx side-tools/wechat-article-cleanup/cli.ts <inbox/xxx.raw.html> [--strip-footer]",
    );
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), arg);
  const raw = readFileSync(inputPath, "utf-8");
  const base = basename(arg).replace(/\.raw\.html?$/i, "");
  const urlMatch = raw.match(/<!--\s*source:\s*([^\n]+)/);
  const cleaned = cleanWeChatArticleRaw(raw, {
    sourceUrl: urlMatch?.[1]?.trim(),
    fetchedAt: new Date().toISOString(),
    stripFooterPatterns: stripFooter,
  });

  const outDir = join(__dirname, "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${base}.md`);
  writeFileSync(outPath, cleaned, "utf-8");
  console.log(`已写入: ${outPath}`);
}

main();
