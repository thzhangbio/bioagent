import type { WechatCleanupBlock } from "./stage-shared.js";

export interface WechatStyleSlotExtraction {
  title: string[];
  intro: string[];
  bridge: string[];
  ending: string[];
  subheading: string[];
  caption: string[];
}

function stripHeadingPrefix(text: string): string {
  return text.replace(/^##\s+/, "").trim();
}

function stripCaptionPrefix(text: string): string {
  return text.replace(/^>\s*图注：/, "").trim();
}

function isValidCaptionSample(text: string): boolean {
  return !/^(撰文|撰写|编辑|授权转载|梅斯学术管理员|备注学术转载|参考资料)/.test(
    text,
  );
}

function isSubstantiveParagraph(text: string): boolean {
  if (!text.trim()) return false;
  if (/^##\s+/.test(text)) return false;
  if (/^>\s*\[/.test(text)) return false;
  if (/^>\s*图注：/.test(text)) return false;
  return true;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isBridgeSentence(text: string): boolean {
  return /(真正的问题在于|但问题在于|那么|换句话说|说白了|不止如此|更值得注意的是|这意味着|总结而言便是|既然|懂了吧|需要注意的是|也就是说|值得注意的是)/.test(
    text,
  );
}

function collectBodyParagraphs(blocks: WechatCleanupBlock[]): string[] {
  return blocks
    .filter((block) => block.slot === "lead" || block.slot === "body")
    .map((block) => block.text.trim())
    .filter(isSubstantiveParagraph);
}

export function extractWechatStyleSlots(input: {
  title?: string;
  blocks: WechatCleanupBlock[];
}): WechatStyleSlotExtraction {
  const subheadings = input.blocks
    .filter((block) => block.slot === "subheading")
    .map((block) => stripHeadingPrefix(block.text))
    .filter(Boolean);

  const captions = input.blocks
    .filter((block) => block.slot === "caption")
    .map((block) => stripCaptionPrefix(block.text))
    .filter(isValidCaptionSample)
    .filter(Boolean);

  const intro = input.blocks
    .filter((block) => block.slot === "lead")
    .map((block) => block.text.trim())
    .filter(isSubstantiveParagraph)
    .slice(0, 4);

  const bodyParagraphs = collectBodyParagraphs(input.blocks);
  const bridgeSet = new Set<string>();
  for (const paragraph of bodyParagraphs) {
    for (const sentence of splitIntoSentences(paragraph)) {
      if (isBridgeSentence(sentence)) {
        bridgeSet.add(sentence);
      }
    }
  }

  const substantiveBlocks = input.blocks.filter(
    (block) => block.slot === "lead" || block.slot === "body",
  );
  const substantiveParagraphs = substantiveBlocks
    .map((block) => block.text.trim())
    .filter(isSubstantiveParagraph);
  const endingPriority = substantiveParagraphs.filter((paragraph) =>
    /(综上所述|总体而言|总的来说|说到底|归根结底|一句话|最后要说的是|最后一句话)/.test(
      paragraph,
    ),
  );
  const ending =
    endingPriority.slice(-2).length > 0 ?
      endingPriority.slice(-2)
    : substantiveParagraphs.slice(-2);

  return {
    title: input.title?.trim() ? [input.title.trim()] : [],
    intro,
    bridge: Array.from(bridgeSet).slice(0, 12),
    ending,
    subheading: subheadings,
    caption: captions,
  };
}

function renderTaggedLines(tag: string, values: string[]): string[] {
  if (values.length === 0) return [`> [风格·${tag}] （未提取到稳定片段）`];
  return values.map((value, index) => `> [风格·${tag}-${index + 1}] ${value}`);
}

export function renderWechatStyleExtractionSection(
  extraction: WechatStyleSlotExtraction,
): string {
  return [
    "## 风格提取",
    "",
    "### 标题",
    ...renderTaggedLines("标题", extraction.title),
    "",
    "### 引入",
    ...renderTaggedLines("引入", extraction.intro),
    "",
    "### 承接",
    ...renderTaggedLines("承接", extraction.bridge),
    "",
    "### 小标题",
    ...renderTaggedLines("小标题", extraction.subheading),
    "",
    "### 图注",
    ...renderTaggedLines("图注", extraction.caption),
    "",
    "### 结尾",
    ...renderTaggedLines("结尾", extraction.ending),
  ].join("\n");
}
