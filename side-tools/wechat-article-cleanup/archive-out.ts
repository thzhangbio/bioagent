/**
 * 【归档 ② — 向量化入库之后】
 * out/ 中已灌入知识库（如 wechat_style）的成品 md 迁入 archive，腾空 out 便于下一批清洗稿。
 * 请在确认 embedding / ingest 已成功后再执行。
 *
 * 用法:
 *   pnpm run wechat-article-archive-out
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { wechatArchiveStamp } from "./archive-stamp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = join(ROOT, "out");
const ARCHIVE = join(ROOT, "archive");

function main(): void {
  const files = readdirSync(OUT).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
  if (files.length === 0) {
    console.log("out/ 下无可归档的 .md（已跳过 README.md）");
    return;
  }
  const dest = join(ARCHIVE, "ingested-out", wechatArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of files) {
    renameSync(join(OUT, f), join(dest, f));
    console.log(`已归档: out/${f} → archive/ingested-out/${basename(dest)}/${f}`);
  }
  console.log(`共 ${files.length} 个文件 → ${dest}`);
}

main();
