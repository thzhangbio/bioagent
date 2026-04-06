import { cleanWeChatArticleRaw } from "../shared/clean-article.js";
import {
  parseMarkdownFrontMatter,
  renderMarkdownFrontMatter,
} from "../shared/markdown-frontmatter.js";

export interface RenderWechatMarkdownOptions {
  sourceUrl?: string;
  slugHint?: string;
  fetchedAt?: string;
  stripFooterPatterns?: boolean;
  engagement?: Parameters<typeof cleanWeChatArticleRaw>[1]["engagement"];
  styleVariant?: string;
  sourceProfile?: string;
  articleCategory?: string;
  styleTask?: string;
}

export function inferWechatStyleTaskFromCategory(
  articleCategory?: string,
): string {
  switch (articleCategory) {
    case "literature_digest":
      return "literature_to_wechat";
    case "clinical_news":
      return "news_to_wechat";
    case "conference_news":
      return "conference_to_wechat";
    case "expert_viewpoint":
      return "commentary_to_wechat";
    case "activity_promo":
    case "recruitment_or_course":
      return "promo_to_wechat";
    case "roundup":
      return "roundup_to_wechat";
    default:
      return "generic_to_wechat";
  }
}

export function renderWechatMarkdownFromRaw(
  rawHtml: string,
  options: RenderWechatMarkdownOptions,
): string {
  return cleanWeChatArticleRaw(rawHtml, {
    sourceUrl: options.sourceUrl,
    slugHint: options.slugHint,
    fetchedAt: options.fetchedAt,
    stripFooterPatterns: options.stripFooterPatterns,
    engagement: options.engagement,
    extraYamlFields: {
      wechat_source_profile: options.sourceProfile,
      wechat_article_category: options.articleCategory,
      wechat_style_variant: options.styleVariant,
      wechat_style_source: options.sourceProfile,
      wechat_style_genre: options.articleCategory,
      wechat_style_task:
        options.styleTask ??
        inferWechatStyleTaskFromCategory(options.articleCategory),
    },
  });
}

export function extractBlocksFromMarkdown(markdown: string): Array<{
  slot:
    | "title"
    | "lead"
    | "subheading"
    | "body"
    | "caption"
    | "diversion"
    | "references"
    | "byline"
    | "footer";
  text: string;
}> {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
  if (!body) return [];
  const blocks = body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  let seenSubheading = false;
  return blocks.map((text, index) => {
    const oneLine = text.replace(/\n+/g, " ").trim();
    const looksLikeReference =
      /^>\s*图注：\s*\[\d+\]\s*[A-Z]/.test(text) ||
      /^>\s*图注：\s*https?:\/\//i.test(text) ||
      /^>\s*图注：.*\b(?:doi|PMID|PMCID)\b/i.test(text) ||
      /^>\s*图注：.*\b(?:JAMA|Nature|Science|Cell|BMJ|Lancet|N Engl J Med)\b/i.test(text);
    const isPlainSubheadingLike =
      !/^>\s*/.test(oneLine) &&
      !/^#{1,6}\s/.test(oneLine) &&
      oneLine.length > 0 &&
      oneLine.length <= 32 &&
      !/[。]/.test(oneLine) &&
      !/[？?]$/.test(oneLine) &&
      !/^(那么|比如|此外|另外|然而|于是|研究表明|研究发现|多项临床研究证实|这项研究发现|这意味着|也就是说|换句话说|总结而言便是|值得注意的是)/.test(
        oneLine,
      ) &&
      (/[:：]$/.test(oneLine) ||
        /^[^\n]{2,20}[！!]$/.test(oneLine) ||
        /“[^”]{2,16}”/.test(oneLine) ||
        !/[，,：:]/.test(oneLine));
    if (/^##\s+/.test(text)) {
      seenSubheading = true;
      return { slot: "subheading", text };
    }
    if (isPlainSubheadingLike) {
      seenSubheading = true;
      return { slot: "subheading", text: `## ${oneLine}` };
    }
    if (text.startsWith("> 图注：")) {
      if (looksLikeReference) {
        return { slot: "references", text: text.replace(/^>\s*图注：\s*/, "> [文献] ") };
      }
      return { slot: "caption", text };
    }
    if (text.startsWith("> [导流]")) return { slot: "diversion", text };
    if (text.startsWith("> [文献]") || text.startsWith("> [参考资料]")) {
      return { slot: "references", text };
    }
    if (text.startsWith("> [署名·")) return { slot: "byline", text };
    if (
      text.startsWith("> [运营]") ||
      text.startsWith("> [转载说明]") ||
      text.startsWith("> [联系方式]") ||
      text.startsWith("> [注释]")
    ) {
      return { slot: "footer", text };
    }
    if (!seenSubheading && index === 0) return { slot: "lead", text };
    if (!seenSubheading) return { slot: "lead", text };
    return { slot: "body", text };
  });
}

export function renderWechatMarkdownFromExistingMarkdown(
  markdown: string,
  updates: Record<string, string | boolean | number | undefined>,
): string {
  const parsed = parseMarkdownFrontMatter(markdown);
  return renderMarkdownFrontMatter(
    {
      ...parsed.fields,
      ...updates,
    },
    parsed.body,
  );
}
