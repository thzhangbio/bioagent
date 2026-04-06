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
    const isPlainSubheadingLike =
      !/^>\s*/.test(oneLine) &&
      !/^#{1,6}\s/.test(oneLine) &&
      oneLine.length > 0 &&
      oneLine.length <= 28 &&
      !/[。]/.test(oneLine) &&
      (/[:：]$/.test(oneLine) ||
        /^[^\n]{2,20}[！!？?]$/.test(oneLine) ||
        /“[^”]{2,16}”/.test(oneLine));
    if (/^##\s+/.test(text)) {
      seenSubheading = true;
      return { slot: "subheading", text };
    }
    if (isPlainSubheadingLike) {
      seenSubheading = true;
      return { slot: "subheading", text: `## ${oneLine}` };
    }
    if (text.startsWith("> 图注：")) return { slot: "caption", text };
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
