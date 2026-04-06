import { chunkText } from "../../../../src/knowledge/chunk.js";
import type {
  WechatCaptionKind,
  WechatContentSlot,
} from "../../../../src/knowledge/types.js";

export function classifyWechatBlock(block: string): {
  slot: WechatContentSlot;
  captionKind?: WechatCaptionKind;
} {
  const firstLine = block.split("\n")[0]?.trim() ?? "";
  const styleSlot = firstLine.match(/^>\s*\[风格·(标题|引入|承接|小标题|图注|结尾)(?:-([a-z_]+))?(?:-\d+)?\]/);
  if (styleSlot) {
    const slotMap: Record<string, WechatContentSlot> = {
      标题: "title",
      引入: "intro",
      承接: "bridge",
      小标题: "subheading",
      图注: "caption",
      结尾: "ending",
    };
    const slot = slotMap[styleSlot[1]!] ?? "body";
    if (slot === "caption") {
      return {
        slot,
        captionKind:
          (styleSlot[2] as WechatCaptionKind | undefined) ?? "general",
      };
    }
    return { slot };
  }
  if (/^>\s*图注/.test(firstLine)) return { slot: "caption", captionKind: "general" };
  if (/^>\s*\[导流\]/.test(firstLine)) return { slot: "diversion" };
  if (/^>\s*\[文献\]/.test(firstLine) || /^>\s*\[参考资料\]/.test(firstLine)) {
    return { slot: "references" };
  }
  if (/^>\s*\[署名·/.test(firstLine)) return { slot: "byline" };
  if (
    /^>\s*\[注释\]/.test(firstLine) ||
    /^>\s*\[转载/.test(firstLine) ||
    /^>\s*\[联系/.test(firstLine) ||
    /^>\s*\[运营\]/.test(firstLine)
  ) {
    return { slot: "footer" };
  }
  return { slot: "body" };
}

export interface WechatSegment {
  slot: WechatContentSlot;
  text: string;
  captionKind?: WechatCaptionKind;
}

export function segmentWechatBody(markdownBody: string): WechatSegment[] {
  const trimmed = markdownBody.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((text) => {
    const classified = classifyWechatBlock(text);
    return {
      slot: classified.slot,
      captionKind: classified.captionKind,
      text,
    };
  });
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
): { slot: WechatContentSlot; text: string; captionKind?: WechatCaptionKind }[] {
  const out: { slot: WechatContentSlot; text: string; captionKind?: WechatCaptionKind }[] = [];
  for (const seg of segments) {
    const parts = chunkText(seg.text);
    for (const text of parts) {
      out.push({ slot: seg.slot, text, captionKind: seg.captionKind });
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
