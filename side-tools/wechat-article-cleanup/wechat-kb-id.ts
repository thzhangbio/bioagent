import { createHash } from "node:crypto";

import { extractArticleIdsFromHtml } from "./appmsg-stats.js";
import { slugFromMpArticleUrl } from "./slug.js";

export interface KbWechatIdOptions {
  sourceUrl?: string;
  /** 与 inbox/out 文件名一致的短链片段（无 HTML 四元组且无 URL 时的兜底） */
  slugHint?: string;
}

/**
 * 知识库侧「同一篇」公众号文章的唯一键（类比文献 DOI），供后续补互动数据、向量化去重合并。
 *
 * - **优先** HTML 内 `biz` / `mid` / `idx` / `sn`（与微信后台消息一致，换短链形式仍相同）
 * - 否则 **`mp1|s|<短链 token>`**（`/s/` 后片段）
 * - 再否则 **`mp1|s|<slugHint>`**（来自文件名）
 * - 最后 **`mp1|h|<sha256 前缀>`**（同文件稳定；仅当以上皆不可用）
 *
 * 前缀 `mp1` 表示格式版本，便于将来演进。
 */
export function computeKbWechatId(
  html: string,
  opts?: KbWechatIdOptions,
): string {
  const { biz, mid, sn, idx } = extractArticleIdsFromHtml(html);
  if (biz && mid && sn && idx !== undefined && idx !== "") {
    return `mp1|${biz}|${mid}|${idx}|${sn}`;
  }
  const url = opts?.sourceUrl?.trim();
  if (url) {
    const slug = slugFromMpArticleUrl(url);
    if (slug) return `mp1|s|${slug}`;
  }
  const hint = opts?.slugHint?.trim();
  if (hint) return `mp1|s|${hint}`;
  const h = createHash("sha256").update(html, "utf8").digest("hex").slice(0, 24);
  return `mp1|h|${h}`;
}
