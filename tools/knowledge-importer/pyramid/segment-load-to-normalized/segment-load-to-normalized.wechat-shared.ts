import { chunkText } from "../../../../src/knowledge/chunk.js";
import type { WechatContentSlot } from "../../../../src/knowledge/types.js";

export function classifyWechatBlock(block: string): WechatContentSlot {
  const firstLine = block.split("\n")[0]?.trim() ?? "";
  if (/^>\s*图注/.test(firstLine)) return "caption";
  if (/^>\s*\[导流\]/.test(firstLine)) return "diversion";
  if (/^>\s*\[文献\]/.test(firstLine) || /^>\s*\[参考资料\]/.test(firstLine)) {
    return "references";
  }
  if (/^>\s*\[署名·/.test(firstLine)) return "byline";
  if (
    /^>\s*\[注释\]/.test(firstLine) ||
    /^>\s*\[转载/.test(firstLine) ||
    /^>\s*\[联系/.test(firstLine) ||
    /^>\s*\[运营\]/.test(firstLine)
  ) {
    return "footer";
  }
  return "body";
}

export interface WechatSegment {
  slot: WechatContentSlot;
  text: string;
}

export function segmentWechatBody(markdownBody: string): WechatSegment[] {
  const trimmed = markdownBody.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((text) => ({
    slot: classifyWechatBlock(text),
    text,
  }));
}

export function parseSimpleYamlFrontMatter(
  yamlBlock: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of yamlBlock.split(/\n/)) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    out[m[1]!] = v;
  }
  return out;
}

export function splitMarkdownFrontMatter(raw: string): {
  front: Record<string, string>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) {
    return { front: {}, body: raw.trim() };
  }
  return {
    front: parseSimpleYamlFrontMatter(m[1]!),
    body: m[2]!.trim(),
  };
}

export function segmentsToChunkTexts(
  segments: WechatSegment[],
): { slot: WechatContentSlot; text: string }[] {
  const out: { slot: WechatContentSlot; text: string }[] = [];
  for (const seg of segments) {
    const parts = chunkText(seg.text);
    for (const text of parts) {
      out.push({ slot: seg.slot, text });
    }
  }
  return out;
}

export function sanitizeWechatFileKey(fileBase: string): string {
  const s = fileBase
    .replace(/[^\w\u4e00-\u9fff+-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return s || "wechat-doc";
}

export function idSafeKbWechatId(kb: string): string {
  return kb.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 96) || "kb";
}
