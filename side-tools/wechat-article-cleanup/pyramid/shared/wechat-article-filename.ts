/**
 * 公众号文章文件名片段：`{mp_name}+{title}`，并做路径安全截断（UTF-8 字节上限）。
 */

import { existsSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { slugFromMpArticleUrl } from "./slug.js";

const INVALID_FS = /[\/\\:*?"<>|\n\r\t\x00-\x1f]/g;

/** 不含扩展名；与 `.md` / `.raw.html` 拼接 */
const MAX_BASENAME_BYTES = 200;

function truncateUtf8Basename(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return buf.subarray(0, end).toString("utf8").trimEnd();
}

/**
 * `公众号名+文章标题` 样式；缺标题或解析失败时用 `fallbackSlug`（通常为 URL 短链 token）。
 */
export function wechatArticleBasename(
  mpName: string | undefined,
  title: string | undefined,
  fallbackSlug: string,
): string {
  const name = (mpName ?? "").trim() || "公众号";
  const tit = (title ?? "").trim();
  let core = tit ? `${name}+${tit}` : `${name}+${fallbackSlug}`;
  core = core
    .replace(INVALID_FS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!core) core = fallbackSlug;
  core = truncateUtf8Basename(core, MAX_BASENAME_BYTES);
  core = core.replace(/[. ]+$/, "").trim();
  if (!core) core = fallbackSlug;
  return core;
}

/** `kb_wechat_id` 的短链兜底：优先 URL 的 `/s/` token，否则用 inbox 文件名片段 */
export function slugHintForKbWechat(
  raw: string,
  inboxBasename: string,
): string {
  const urlMatch = raw.match(/<!--\s*source:\s*([^\n]+)/);
  const sourceUrl = urlMatch?.[1]?.trim();
  if (sourceUrl) {
    const u = slugFromMpArticleUrl(sourceUrl);
    if (u) return u;
  }
  return inboxBasename;
}

/**
 * 清洗成功后，将 inbox 内 raw 文件名改为与 `outBase` 一致（与 `.md` 同基名）。
 * 若已同名或目标路径已存在则跳过。
 */
export function renameInboxRawToOutBasename(
  inboxFilePath: string,
  inboxBasenameNoExt: string,
  outBasename: string,
): void {
  if (inboxBasenameNoExt === outBasename) return;
  const extMatch = inboxFilePath.match(/(\.raw\.html?|\.md)$/i);
  const ext = extMatch?.[0] ?? ".raw.html";
  const dir = dirname(inboxFilePath);
  const nextPath = join(dir, `${outBasename}${ext}`);
  if (inboxFilePath === nextPath) return;
  if (existsSync(nextPath)) {
    console.warn(
      `inbox 目标已存在，跳过重命名: ${basename(nextPath)}`,
    );
    return;
  }
  renameSync(inboxFilePath, nextPath);
  console.log(
    `已重命名 inbox: ${basename(inboxFilePath)} → ${basename(nextPath)}`,
  );
}
