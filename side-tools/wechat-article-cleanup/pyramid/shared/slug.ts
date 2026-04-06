/**
 * 从微信公众号文章 URL 生成稳定文件名片段（`/s/<token>`）。
 */
export function slugFromMpArticleUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("mp.weixin.qq.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const sIdx = parts.indexOf("s");
    if (sIdx >= 0 && parts[sIdx + 1]) {
      const token = parts[sIdx + 1]!;
      return token.replace(/[^\w-]/g, "_").slice(0, 120) || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isMpWeixinArticleUrl(url: string): boolean {
  return slugFromMpArticleUrl(url) !== null;
}
