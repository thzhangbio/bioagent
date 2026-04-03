export interface ChunkOptions {
  /** 每块最大字符数（中文场景按字计数） */
  chunkSize: number;
  /** 块之间重叠字符数，避免句意被切断 */
  overlap: number;
}

const DEFAULTS: ChunkOptions = {
  chunkSize: 900,
  overlap: 120,
};

/**
 * 按固定窗口 + 重叠切分文本；岗位描述多为短段落，此策略足够做实验。
 */
export function chunkText(raw: string, options: Partial<ChunkOptions> = {}): string[] {
  const { chunkSize, overlap } = { ...DEFAULTS, ...options };
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}
