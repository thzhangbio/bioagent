/**
 * MinerU 原始 Markdown → 初步稿件（**保留** `# …` Markdown 标题，便于切块与向量化），再交给 {@link cleanMarkdownForKnowledgeBase}。
 */

const MD_IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

/**
 * 各刊 MinerU 常见刊头/占位行：压缩为「# 标题 + 必要 DOI」，减少与 Elsevier 流水线不一致时的噪声。
 */
function normalizeMineruFrontMatterBlock(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");

  /** Springer Nature / MP：刊名 + 域名 + OPEN ACCESS 行 → 直接进入 # 标题 */
  s = s.replace(
    /^Molecular Psychiatry\s*\n\s*www\.nature\.com\/[^\s]*\s*\n\s*ARTICLE OPEN\s*\n\s*(#\s*[^\n]+)/im,
    "$1",
  );

  /** Lancet / eBioMedicine：`Articles` 占位行 + # 标题 */
  s = s.replace(/^Articles\s*\n\s*(#\s*[^\n]+)/im, "$1");

  /** Nature Medicine：多行刊头 + DOI + # 标题 → 标题与 DOI */
  s = s.replace(
    /^nature medicine\s*\n\s*a\s*\n\s*Brief Communication\s*\n\s*(https:\/\/doi\.org\/[^\s\n]+)\s*\n\s*(#\s*[^\n]+)/im,
    "$2\n\n$1",
  );

  /** Nature Communications：Article in Press 块 + 期刊行 + DOI + Article in Press + # 标题 */
  s = s.replace(
    /^(?:ARTICLE IN PRESS\s*\n)+Nature Communications\s*\n(https:\/\/doi\.org\/[^\s\n]+)\s*\n\s*Article in Press\s*\n\s*(#\s*[^\n]+)/im,
    "$2\n\n$1",
  );

  return s;
}

export function mineruRawMarkdownToPreliminary(raw: string): string {
  const lines = normalizeMineruFrontMatterBlock(raw).split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\(legend continued on next page\)\s*$/i.test(trimmed)) continue;

    if (MD_IMAGE_LINE.test(trimmed)) {
      out.push("");
      continue;
    }

    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      out.push(trimmed);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}
