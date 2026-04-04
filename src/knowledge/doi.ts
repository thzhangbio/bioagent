/**
 * 文献事实层：以 DOI（注册形式 `10.xxxx/...`）作为同一篇论文的稳定主键。
 * @see docs/知识库分层与文献库规划.md
 */

/** 注册 DOI 路径（不含 resolver 前缀） */
const REGISTRY_DOI = /^(10\.\d{4,}\/.+)$/i;

/** 从 resolver URL 或裸字符串中解析出注册 DOI */
export function normalizeDoi(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^doi:\s*/i, "");

  const fromUrl = s.match(
    /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^?\s#"'<>]+)/i,
  );
  if (fromUrl) {
    return stripTrailingJunk(decodeURIComponent(fromUrl[1]));
  }

  s = stripTrailingJunk(s);
  if (REGISTRY_DOI.test(s)) return s;

  return null;
}

function stripTrailingJunk(path: string): string {
  return path.replace(/[)\].,;]+$/g, "").replace(/\/+$/g, "");
}

/**
 * 用于向量块 `id` 等：仅 ASCII，避免 `/` 等特殊字符。
 */
export function doiToSlug(doi: string): string {
  return doi.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/**
 * 判断 `paperId` 是否应视为 DOI（可规范化）。
 */
export function looksLikeDoiString(s: string): boolean {
  return /^10\.\d{4,}\//i.test(s.trim());
}

/**
 * 从 Markdown 正文中取**首个**疑似 DOI（用于无 meta 时的兜底）。
 * 优先 `https://doi.org/10....`，否则裸 `10....`。
 */
export function extractFirstDoiFromMarkdown(md: string): string | null {
  const url = md.match(
    /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s\])"'<>]+)/i,
  );
  if (url) return normalizeDoi(url[0]);

  const bare = md.match(/\b(10\.\d{4,}\/[^\s\])"'<>]+)/);
  if (bare) return normalizeDoi(bare[1]);

  return null;
}
