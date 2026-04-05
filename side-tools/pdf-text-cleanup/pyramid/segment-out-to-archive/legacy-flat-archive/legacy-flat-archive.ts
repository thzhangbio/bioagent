/**
 * 将 **archive/** 根目录下历史平铺的 MinerU **.md / .json**（旧版 inbox 处理完后直接放在 archive 根下）
 * 迁入 **archive/processed-mineru/<时间戳>/**，与 `pdf-archive-inbox` 目标目录一致。
 * 不移动 **README.md**；不扫描子目录（**ingested-out/**、**processed-mineru/** 等保持不变）。
 *
 * 用法:
 *   pnpm run pdf-archive-legacy-flat
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { pdfArchiveStamp } from "../segment-out-to-archive.archive-stamp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const ARCHIVE = join(ROOT, "archive");

function main(): void {
  let files: string[];
  try {
    files = readdirSync(ARCHIVE);
  } catch {
    console.error("无法读取 archive/");
    process.exit(1);
  }
  const targets = files.filter((f) => {
    if (f === "README.md") return false;
    return f.endsWith(".md") || f.endsWith(".json");
  });
  if (targets.length === 0) {
    console.log("archive/ 根目录下无可迁移的 .md / .json");
    return;
  }
  const dest = join(ARCHIVE, "processed-mineru", pdfArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of targets) {
    renameSync(join(ARCHIVE, f), join(dest, f));
    console.log(`已归档: archive/${f} → archive/processed-mineru/${basename(dest)}/${f}`);
  }
  console.log(`共 ${targets.length} 个文件 → ${dest}`);
}

main();
