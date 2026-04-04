/**
 * MinerU 原始 Markdown → 「初步处理」纯文本向稿件（与 inbox 中 plain 论文 md 一致），再交给 {@link cleanMarkdownForKnowledgeBase}。
 */

const MD_IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

export function mineruRawMarkdownToPreliminary(raw: string): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\(legend continued on next page\)\s*$/i.test(trimmed)) continue;
    if (/^#\s*Cancer Cell\s*$/i.test(trimmed)) {
      out.push("Cancer Cell");
      continue;
    }
    if (/^#\s*Article\s*$/i.test(trimmed)) {
      out.push("Article");
      continue;
    }

    if (MD_IMAGE_LINE.test(trimmed)) {
      out.push("");
      continue;
    }

    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      out.push(hm[2]);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}
