/**
 * 【归档 ① — 流水线之后】
 * 已将 MinerU 导出生成 `out/*.kb.md` 且确认无误后，将 **inbox/** 内待归档的原始 **.md / .json** 迁入 archive，腾空 inbox。
 * （与「入库归档」独立；适用于把 MinerU 导出先放入本目录 `inbox/` 的工作流。）
 *
 * 用法:
 *   pnpm run pdf-archive-inbox
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { pdfArchiveStamp } from "./archive-stamp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INBOX = join(ROOT, "inbox");
const ARCHIVE = join(ROOT, "archive");

function main(): void {
  let files: string[];
  try {
    files = readdirSync(INBOX);
  } catch {
    console.error("无法读取 inbox/（若尚未创建，请先建立 inbox 并放入 MinerU 导出）");
    process.exit(1);
  }
  const targets = files.filter(
    (f) =>
      (f.endsWith(".md") || f.endsWith(".json")) &&
      f !== "README.md",
  );
  if (targets.length === 0) {
    console.log("inbox/ 下无可归档的 .md / .json（已跳过 README.md）");
    return;
  }
  const dest = join(ARCHIVE, "processed-mineru", pdfArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of targets) {
    renameSync(join(INBOX, f), join(dest, f));
    console.log(`已归档: inbox/${f} → archive/processed-mineru/${basename(dest)}/${f}`);
  }
  console.log(`共 ${targets.length} 个文件 → ${dest}`);
}

main();
