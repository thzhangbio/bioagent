/**
 * 【归档 ① — 流水线之后】
 * inbox 中已用于生成 out 的原始稿（*.raw.html）迁入 archive，腾空 inbox 便于下一批抓取。
 * 请在确认 out/ 结果无误后再执行（与「入库归档」独立）。
 *
 * 用法:
 *   pnpm run wechat-article-archive-inbox
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { wechatArchiveStamp } from "./archive-stamp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const INBOX = join(ROOT, "inbox");
const ARCHIVE = join(ROOT, "archive");

function isRawHtml(name: string): boolean {
  return /\.raw\.html?$/i.test(name);
}

function main(): void {
  let files: string[];
  try {
    files = readdirSync(INBOX);
  } catch {
    console.error("无法读取 inbox/");
    process.exit(1);
  }
  const targets = files.filter(
    (f) => isRawHtml(f) && f !== "README.md",
  );
  if (targets.length === 0) {
    console.log("inbox/ 下无可归档的 .raw.html / .raw.htm");
    return;
  }
  const dest = join(ARCHIVE, "processed-inbox", wechatArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of targets) {
    renameSync(join(INBOX, f), join(dest, f));
    console.log(`已归档: inbox/${f} → archive/processed-inbox/${basename(dest)}/${f}`);
  }
  console.log(`共 ${targets.length} 个原始文件 → ${dest}`);
}

main();
