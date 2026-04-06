import type { WechatCleanupBlock } from "./stage-shared.js";

export interface WechatStyleSlotExtraction {
  title: string[];
  intro: string[];
  bridge: string[];
  ending: string[];
  subheading: string[];
  caption: Array<{
    kind:
      | "general"
      | "paper_title_screenshot"
      | "doi_card"
      | "reference_card"
      | "figure_result"
      | "figure_mechanism"
      | "figure_summary";
    text: string;
  }>;
}

function stripHeadingPrefix(text: string): string {
  return text.replace(/^##\s+/, "").trim();
}

function stripCaptionPrefix(text: string): string {
  return text.replace(/^>\s*图注：/, "").trim();
}

function isValidCaptionSample(text: string): boolean {
  if (
    /^(撰文|撰写|编辑|授权转载|梅斯学术管理员|备注学术转载|参考资料)/.test(
      text,
    )
  ) {
    return false;
  }
  if (/^\[\d+\]\s*[A-Z]/.test(text)) return false;
  if (/https?:\/\//i.test(text)) return false;
  if (
    /\b(?:doi|PMID|PMCID)\b\s*[:.]/i.test(text) ||
    /\b(?:JAMA|Nature|Science|Cell|BMJ|Lancet|N Engl J Med)\b/i.test(text)
  ) {
    return false;
  }
  return true;
}

function classifyCaptionKind(text: string):
  | "general"
  | "paper_title_screenshot"
  | "doi_card"
  | "reference_card"
  | "figure_result"
  | "figure_mechanism"
  | "figure_summary" {
  const t = text.trim();
  if (
    /^(?:图\s*\d+\s*[:：]\s*)?标题$/i.test(t) ||
    /^(?:title|paper title)$/i.test(t)
  ) {
    return "paper_title_screenshot";
  }
  if (/^\[\d+\]\s*[A-Z]/.test(t) || /\b(?:JAMA|Nature|Science|Cell|BMJ|Lancet|N Engl J Med)\b/i.test(t)) {
    return "reference_card";
  }
  if (/^DOI[:：]/i.test(t) || /\bdoi\b[:.]/i.test(t)) {
    return "doi_card";
  }
  if (/^(标题|Title)\b/i.test(t)) {
    return "paper_title_screenshot";
  }
  if (/(机制|通路|示意图|模型|轴|信号传导)/.test(t)) {
    return "figure_mechanism";
  }
  if (/(结果|对比|评分|风险|相关|系数|相对偏好|图\d|表\d|效果)/.test(t)) {
    return "figure_result";
  }
  if (/(总结|概览|总览|流程|构成|分布|归属)/.test(t)) {
    return "figure_summary";
  }
  return "general";
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

function isWeakSubheading(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[>#[\-\d]/.test(t)) return true;
  if (/[。；]/.test(t)) return true;
  if (
    /^(那么|比如|此外|另外|然而|于是|研究表明|研究发现|多项临床研究证实|这项研究发现|这意味着|也就是说|换句话说|总结而言便是|值得注意的是)/.test(
      t,
    )
  ) {
    return true;
  }
  if (/[？?]$/.test(t)) return true;
  return false;
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
    .filter(Boolean)
    .map((text) => ({
      kind: classifyCaptionKind(text),
      text,
    }));

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
    subheading: subheadings.filter((item) => !isWeakSubheading(item)),
    caption: captions,
  };
}

function renderTaggedLines(tag: string, values: string[]): string[] {
  if (values.length === 0) return [`> [风格·${tag}] （未提取到稳定片段）`];
  return values.map((value, index) => `> [风格·${tag}-${index + 1}] ${value}`);
}

function renderCaptionTaggedLines(
  values: WechatStyleSlotExtraction["caption"],
): string[] {
  if (values.length === 0) return ["> [风格·图注] （未提取到稳定片段）"];
  return values.map(
    (value, index) => `> [风格·图注-${value.kind}-${index + 1}] ${value.text}`,
  );
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
    ...renderCaptionTaggedLines(extraction.caption),
    "",
    "### 结尾",
    ...renderTaggedLines("结尾", extraction.ending),
  ].join("\n");
}
