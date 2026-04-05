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

/** `10.1038_s41380-026-03588-2` → `10.1038/s41380-026-03588-2`（与 {@link doiToFilenameSegment} 互逆） */
export function doiSegmentToDoi(segment: string): string | null {
  if (!segment || segment === "no-doi") return null;
  const i = segment.indexOf("_");
  if (i <= 0) return null;
  return `${segment.slice(0, i)}/${segment.slice(i + 1).replace(/_/g, "/")}`;
}

/** 归档基名形如 `时间戳+slug+10.1038_…`，取出 DOI 段 */
export function extractDoiSegmentFromArchiveBasename(basename: string): string | null {
  const parts = basename.split("+");
  for (const p of parts) {
    if (/^10\.[0-9]+_/.test(p)) return p;
  }
  return null;
}

/**
 * 由论文标题字符串生成归档 slug（小写、连字符），与终稿 YAML `kb_metadata.title` 一致时使用。
 * 非拉丁或过短时用 `fallbackSlug`（一般为源文件名不含扩展名）。
 */
export function slugFromArticleTitle(title: string, fallbackSlug = ""): string {
  let raw = (title ?? "").trim();
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

/**
 * 取首行 `# 标题`，去掉行内 DOI 后交给 {@link slugFromArticleTitle}。
 */
export function slugFromKbMarkdown(md: string, fallbackSlug = ""): string {
  const m = md.match(/^#\s+(.+)$/m);
  const line = m ? m[1].trim() : "";
  return slugFromArticleTitle(line, fallbackSlug);
}

/**
 * 从已写入 `kb_metadata` 的终稿 Markdown 中解析 `title:`（与本工具生成的 JSON 字符串格式兼容）。
 */
export function extractKbMetadataTitleFromFrontMatter(md: string): string | null {
  if (!md.startsWith("---\n")) return null;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const yaml = md.slice(4, end);
  if (!yaml.includes("kb_metadata:")) return null;
  const m = yaml.match(/^\s+title:\s+(.+)$/m);
  if (!m) return null;
  const rest = m[1].trim();
  if (rest.startsWith('"')) {
    try {
      return JSON.parse(rest) as string;
    } catch {
      return null;
    }
  }
  if (rest.startsWith("'") && rest.endsWith("'")) {
    return rest.slice(1, -1).replace(/''/g, "'");
  }
  return rest;
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

/**
 * 终稿已含 `kb_metadata` YAML 时：slug 取自元数据头中的 **title**，DOI 取自正文/YAML 中首条 doi.org。
 */
export function buildKbArchiveFilenamePartsFromKbMetadata(
  finalMdWithYaml: string,
  filenameFallbackForSlug?: string,
): KbArchiveNameParts {
  const doi = extractPrimaryDoiFromMarkdown(finalMdWithYaml);
  const metaTitle = extractKbMetadataTitleFromFrontMatter(finalMdWithYaml);
  const slug = slugFromArticleTitle(
    metaTitle ?? "",
    filenameFallbackForSlug ?? "",
  );
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
