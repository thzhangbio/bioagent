/**
 * 【归档 ② — 向量化入库之后】
 * `out/*.kb.md` 已复制/灌入 `data/knowledge/literature-inbox` 并完成 **ingest:literature** 后，将成品迁入 archive，腾空 out。
 *
 * 用法:
 *   pnpm run pdf-archive-out
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pdfArchiveStamp } from "./archive-stamp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = join(ROOT, "out");
const ARCHIVE = join(ROOT, "archive");

function main(): void {
  let files: string[];
  try {
    files = readdirSync(OUT);
  } catch {
    console.error("无法读取 out/");
    process.exit(1);
  }
  const targets = files.filter((f) => f.endsWith(".kb.md"));
  if (targets.length === 0) {
    console.log("out/ 下无可归档的 .kb.md");
    return;
  }
  const dest = join(ARCHIVE, "ingested-out", pdfArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of targets) {
    renameSync(join(OUT, f), join(dest, f));
    console.log(`已归档: out/${f} → archive/ingested-out/${basename(dest)}/${f}`);
  }
  console.log(`共 ${targets.length} 个文件 → ${dest}`);
}

main();
