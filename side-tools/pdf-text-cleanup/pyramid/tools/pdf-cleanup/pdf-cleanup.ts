/**
 * 仅「初步稿 → 终版」：`cleanPdfTextMd`。
 * 完整链路（MinerU 原始 MD + 可选 JSON）见 `segment-inbox-to-out.ts` / `pnpm run pdf-kb-pipeline`。
 *
 * 用法（在仓库根目录）:
 *   pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/tools/pdf-cleanup/pdf-cleanup.ts side-tools/pdf-text-cleanup/inbox/某文件.md
 * 输出: side-tools/pdf-text-cleanup/out/<同名>.cleaned.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanPdfTextMd } from "../../segment-inbox-to-out/segment-inbox-to-out.cleanup-shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_TEXT_CLEANUP_ROOT = resolve(__dirname, "../../..");

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  const arg = argv[0];
  if (!arg) {
    console.error(
      "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pyramid/tools/pdf-cleanup/pdf-cleanup.ts <输入.md>",
    );
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), arg);
  const raw = readFileSync(inputPath, "utf-8");
  const cleaned = cleanPdfTextMd(raw);

  const outDir = join(PDF_TEXT_CLEANUP_ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  const base = basename(arg, ".md");
  const outPath = join(outDir, `${base}.cleaned.md`);
  writeFileSync(outPath, cleaned, "utf-8");

  console.log(`已写入: ${outPath}`);
  console.log(`原始约 ${raw.length} 字符 → 整理后约 ${cleaned.length} 字符`);
}

main();
