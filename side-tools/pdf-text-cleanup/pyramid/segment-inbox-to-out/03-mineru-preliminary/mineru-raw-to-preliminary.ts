/**
 * MinerU 原始 Markdown → 初步稿件（**保留** `# …` Markdown 标题，便于切块与向量化），再交给 {@link cleanMarkdownForKnowledgeBase}。
 */

const MD_IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

function digitStringToUnicodeSuperscript(digits: string): string {
  return [...digits]
    .map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? c)
    .join("");
}

function normalizeMineruSupTags(line: string): string {
  const trimmed = line.trim();
  const affiliationLike =
    /^<sup>\d+<\/sup>[A-Z][^\n]{8,}$/.test(trimmed) &&
    /university|hospital|department|institute|center|centre|clinic|medizin|germany|china|school/i.test(
      trimmed,
    );

  if (affiliationLike) {
    return line.replace(/<sup>(\d+)<\/sup>/g, (_, digits: string) =>
      digitStringToUnicodeSuperscript(digits),
    );
  }

  return line.replace(/<sup>(\d+)<\/sup>/g, "[$1]");
}

function normalizeMineruHtmlTags(line: string): string {
  let s = normalizeMineruSupTags(line);
  s = s.replace(/<sub>(\d+)<\/sub>/gi, (_, digits: string) =>
    [...digits].map((c) => "₀₁₂₃₄₅₆₇₈₉"[Number(c)] ?? c).join(""),
  );
  s = s.replace(/<h([1-6])>\s*([^<]+?)\s*<\/h\1>/gi, "$2");
  s = s.replace(/<\/?(?:i|b|em|strong|u|span|p)>/gi, "");
  return s;
}

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
    const normalizedLine = normalizeMineruHtmlTags(line);
    const trimmed = normalizedLine.trim();

    if (/^\(legend continued on next page\)\s*$/i.test(trimmed)) continue;

    if (MD_IMAGE_LINE.test(trimmed)) {
      out.push("");
      continue;
    }

    const hm = normalizedLine.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      out.push(trimmed);
      continue;
    }

    out.push(normalizedLine);
  }

  return out.join("\n");
}
