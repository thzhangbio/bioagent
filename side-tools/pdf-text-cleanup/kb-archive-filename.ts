/**
 * 知识库终稿归档文件名：`{YYYYMMDDHHmm}+{slug}+{doi 段}.kb.md`
 *（与 `archive/ingested-out` 下命名习惯一致，DOI 中 `/` 换为 `_`）
 */

/** 去掉文首 MinerU 结构摘要（可能极长），避免首条 DOI 落在正文之后而无法匹配 */
function markdownBodyAfterStructureManifest(md: string): string {
  const m = md.match(
    /^##\s*文档结构（MinerU JSON，版面顺序）[\s\S]*?\n---\s*\n+/,
  );
  return m ? md.slice(m[0].length) : md;
}

/** 正文内首条 `https://doi.org/10.…`（通常为文章 DOI；若标题行带 DOI 会最先出现） */
export function extractPrimaryDoiFromMarkdown(md: string): string | null {
  const body = markdownBodyAfterStructureManifest(md);
  const m = body.match(/https?:\/\/doi\.org\/(10\.[^\s\])'"<>]+)/i);
  if (!m) return null;
  let id = m[1].replace(/[.,;:)]+$/, "");
  id = id.replace(/\s+/g, "");
  return id || null;
}

/** `10.1016/j.ebiom.2026.106209` → `10.1016_j.ebiom.2026.106209` */
export function doiToFilenameSegment(doi: string): string {
  return doi.replace(/\//g, "_").replace(/[^0-9a-zA-Z_.-]/g, "");
}

/**
 * 取首行 `# 标题`，去掉行内 DOI 后做 slug（小写、连字符）。
 * 非拉丁或过短时用 `fallbackSlug`（一般为源文件名不含扩展名）。
 */
export function slugFromKbMarkdown(md: string, fallbackSlug = ""): string {
  const m = md.match(/^#\s+(.+)$/m);
  let raw = m ? m[1].trim() : "";
  raw = raw.replace(/\s*https?:\/\/doi\.org\/\S+/gi, "").trim();
  raw = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  raw = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  if (raw.length >= 3) return raw.slice(0, 56);
  const fb = fallbackSlug
    .replace(/\.(md|txt)$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (fb.length >= 2) return fb.slice(0, 56);
  return "article";
}

export function formatKbArchiveTimestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

export interface KbArchiveNameParts {
  timestamp: string;
  slug: string;
  doiSegment: string;
}

export function buildKbArchiveFilenameParts(
  md: string,
  filenameFallbackForSlug?: string,
): KbArchiveNameParts {
  const doi = extractPrimaryDoiFromMarkdown(md);
  const slug = slugFromKbMarkdown(md, filenameFallbackForSlug ?? "");
  const doiSegment = doi ? doiToFilenameSegment(doi) : "no-doi";
  return {
    timestamp: formatKbArchiveTimestamp(),
    slug,
    doiSegment,
  };
}

export function buildKbArchiveBasename(parts: KbArchiveNameParts): string {
  return `${parts.timestamp}+${parts.slug}+${parts.doiSegment}.kb.md`;
}
