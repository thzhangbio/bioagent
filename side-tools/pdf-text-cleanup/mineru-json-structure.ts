/**
 * 从 MinerU 结构化 JSON 抽取版面块顺序，用于与正文结合写入终版。
 */

export interface MineruStructureEntry {
  page: number;
  index: number;
  type: string;
  preview: string;
}

interface MineruSpan {
  type?: string;
  content?: string;
  image_path?: string;
}

interface MineruLine {
  spans?: MineruSpan[];
}

interface MineruBlock {
  type?: string;
  index?: number;
  lines?: MineruLine[];
  blocks?: MineruBlock[];
}

function spanText(spans: MineruSpan[] | undefined): string {
  if (!spans?.length) return "";
  return spans
    .map((sp) => (sp.type === "text" && sp.content ? sp.content : ""))
    .join("");
}

function linesText(lines: MineruLine[] | undefined): string {
  if (!lines?.length) return "";
  return lines
    .map((ln) => spanText(ln.spans))
    .filter(Boolean)
    .join(" ");
}

function extractBlockPreview(block: MineruBlock): string {
  const ty = block.type ?? "";
  if (ty === "image") {
    const captions: string[] = [];
    if (block.blocks) {
      for (const b of block.blocks) {
        if (b.type === "image_caption" || b.type === "title") {
          const t = extractBlockPreview(b);
          if (t) captions.push(t);
        }
      }
    }
    return captions.length ? `[插图] ${captions.join(" ")}` : "[插图]";
  }
  if (block.lines?.length) return linesText(block.lines);
  if (block.blocks?.length) {
    return block.blocks.map(extractBlockPreview).filter(Boolean).join(" ");
  }
  return "";
}

export function listMineruStructure(json: unknown): MineruStructureEntry[] {
  const root = json as {
    pdf_info?: Array<{ para_blocks?: MineruBlock[] }>;
  };
  const entries: MineruStructureEntry[] = [];
  let globalIndex = 0;
  const pages = root.pdf_info ?? [];
  for (let pi = 0; pi < pages.length; pi++) {
    const blocks = pages[pi].para_blocks ?? [];
    for (const b of blocks) {
      const preview = extractBlockPreview(b).replace(/\s+/g, " ").trim();
      entries.push({
        page: pi + 1,
        index: globalIndex++,
        type: b.type ?? "unknown",
        preview: preview.slice(0, 200),
      });
    }
  }
  return entries;
}

/** 文首结构摘要（便于向量检索按块类型/页码对齐） */
export function formatStructureSectionForKb(entries: MineruStructureEntry[]): string {
  if (entries.length === 0) return "";
  const parts: string[] = [
    "## 文档结构（MinerU JSON，版面顺序）",
    "",
  ];
  for (const e of entries) {
    const safe = e.preview.replace(/\|/g, "｜");
    parts.push(`- [p${e.page}] ${e.type} #${e.index}: ${safe}`);
  }
  /** 用段落分隔每条，避免 mergeSoftLineBreaks 把列表粘成一行 */
  return `${parts.join("\n\n")}\n\n---\n\n`;
}
