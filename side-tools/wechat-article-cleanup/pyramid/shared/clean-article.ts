/**
 * 将 inbox 中的原始 HTML（或纯文本）整理为适合 RAG / 编辑的 Markdown 取向纯文本。
 * 抽取优先：`#js_content` 正文区（嵌套 div 深度扫描）；失败则退化为去标签草稿。
 */

import type { WechatEngagementMetrics } from "./appmsg-stats.js";
import {
  extractWechatArticleMeta,
  yamlDoubleQuotedScalar,
} from "./wechat-meta.js";
import { computeKbWechatId } from "./wechat-kb-id.js";

/** 与 `ingest-wechat` 子风格一致；无法从公众号名推断时不写该 YAML 行 */
function inferWechatStyleVariant(mpName: string | undefined): string | undefined {
  const m = mpName?.trim() ?? "";
  if (/梅斯/.test(m)) return "medsci";
  if (/良医/.test(m)) return "liangyi_hui";
  return undefined;
}

/** 自 HTML 中取出 `id="js_content"` 外层 div 的内层 HTML */
function extractJsContentHtml(html: string): string | null {
  let openEnd = -1;
  for (const mk of ['id="js_content"', "id='js_content'"]) {
    const i = html.indexOf(mk);
    if (i === -1) continue;
    const gt = html.indexOf(">", i);
    if (gt === -1) continue;
    openEnd = gt + 1;
    break;
  }
  if (openEnd < 0) return null;

  let depth = 1;
  let pos = openEnd;
  while (pos < html.length && depth > 0) {
    const rest = html.slice(pos);
    const mDiv = /<div\b/i.exec(rest);
    const mClose = /<\/div>/i.exec(rest);
    const iDiv = mDiv?.index ?? Infinity;
    const iClose = mClose?.index ?? -1;
    if (iClose < 0) return html.slice(openEnd);
    if (iDiv < iClose) {
      depth += 1;
      pos += iDiv + 4;
    } else {
      const closeLen = mClose![0].length;
      const innerEnd = pos + iClose;
      depth -= 1;
      if (depth === 0) return html.slice(openEnd, innerEnd);
      pos = innerEnd + closeLen;
    }
  }
  return null;
}

function stripTagsToText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<\/section>/gi, "\n\n");
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return s;
}

/** 微信图注常见灰色（与正文黑字、小标题蓝字区分） */
const WECHAT_CAPTION_GRAY = /rgb\s*\(\s*136\s*,\s*136\s*,\s*136\s*\)/i;

/** 阶段性小标题通常较短；同一样式的「蓝粗要点段」往往是一整段摘要，需排除。 */
const WECHAT_SUBHEADING_MAX_CHARS = 48;

function isWeChatFigureCaptionHtml(fragmentHtml: string): boolean {
  if (!WECHAT_CAPTION_GRAY.test(fragmentHtml)) return false;
  if (
    /rgb\s*\(\s*59\s*,\s*115\s*,\s*185\s*\)/i.test(fragmentHtml) ||
    /rgb\s*\(\s*76\s*,\s*119\s*,\s*175\s*\)/i.test(fragmentHtml)
  ) {
    return false;
  }
  return true;
}

/**
 * 同为灰字 rgb(136) 的还有：文首/文末「注：」、参考资料、撰文编辑、转载联系方式等——不是图注。
 */
function isNonFigureGrayAnnotation(plain: string): boolean {
  const t = plain.replace(/\s+/g, " ").trim();
  if (/^注[：:]/.test(t)) return true;
  if (/^参考资料[：:]?/.test(t)) return true;
  if (/^撰文[：:]/.test(t)) return true;
  if (/^编辑[：:]/.test(t)) return true;
  if (/授权转载/.test(t)) return true;
  if (/梅斯学术管理员/.test(t)) return true;
  if (/备注学术转载/.test(t)) return true;
  if (/点击[「"]?阅读原文/.test(t)) return true;
  if (/即刻加入科研会员/.test(t)) return true;
  if (/DeepEvidence/.test(t) && (/点击|小程序|一键/.test(t))) return true;
  if (/^\[\d+\]\s*[A-Za-z]/.test(t) && /doi\s*:/i.test(t)) return true;
  if (t.length > 120 && /PMID\s*:\s*\d+/i.test(t)) return true;
  if (t.length > 120 && /PMCID\s*:/i.test(t)) return true;
  return false;
}

function shouldMarkAsFigureCaption(fragmentHtml: string, plain: string): boolean {
  if (!isWeChatFigureCaptionHtml(fragmentHtml)) return false;
  return !isNonFigureGrayAnnotation(plain);
}

/**
 * 非正文、非图注的元信息 / 运营块：用引用块 + `[属性]` 便于灌库与检索。
 * 与 `isNonFigureGrayAnnotation` 覆盖范围一致；未命中则返回 null（按正文输出）。
 */
function formatNonBodyMetadata(plain: string): string | null {
  const t = plain.replace(/\s+/g, " ").trim();
  if (!t) return null;

  if (/DeepEvidence/.test(t) && /点击|小程序|一键|查询|下方/.test(t)) {
    return `> [导流] ${t}`;
  }
  if (/^注[：:]/.test(t)) return `> [注释] ${t}`;
  if (/^参考资料[：:]?$/.test(t)) return `> [参考资料]`;
  if (/^\[\d+\]\s*[A-Za-z]/.test(t) && /doi\s*:/i.test(t)) {
    return `> [文献] ${t}`;
  }
  if (t.length > 120 && /PMID\s*:\s*\d+/i.test(t) && /doi\s*:/i.test(t)) {
    return `> [文献] ${t}`;
  }
  if (/^撰文[：:]/.test(t)) return `> [署名·撰文] ${t}`;
  if (/^编辑[：:]/.test(t)) return `> [署名·编辑] ${t}`;
  if (/授权转载/.test(t) && !/微信bjy|微信号\d/.test(t)) {
    return `> [转载说明] ${t}`;
  }
  if (/梅斯学术管理员微信|备注学术转载/.test(t)) {
    return `> [联系方式] ${t}`;
  }
  if (/点击[「"]?阅读原文/.test(t) || /即刻加入科研会员/.test(t)) {
    return `> [运营] ${t}`;
  }
  return null;
}

function emitParagraphOrMetadata(plain: string, oneLine: string): string {
  const meta = formatNonBodyMetadata(oneLine);
  if (meta) return meta;
  return plain;
}

/**
 * 微信图文里「阶段性小标题」常为 span 内联样式：蓝色 + 粗体（非标准 h2/h3）。
 */
function isWeChatSectionSubheading(pInnerHtml: string): boolean {
  if (!/font-weight\s*:\s*(bold|700)/i.test(pInnerHtml)) return false;
  const blue =
    /rgb\s*\(\s*59\s*,\s*115\s*,\s*185\s*\)/i.test(pInnerHtml) ||
    /rgb\s*\(\s*76\s*,\s*119\s*,\s*175\s*\)/i.test(pInnerHtml);
  if (!blue) return false;
  const t = stripTagsToText(pInnerHtml).replace(/\s+/g, " ").trim();
  if (t.length === 0 || t.length > WECHAT_SUBHEADING_MAX_CHARS) return false;
  return true;
}

/** `</section>` 之间的片段：含灰字图注的标为引用块，避免与正文混排。 */
function pushGapChunks(chunks: string[], gapHtml: string): void {
  const segments = gapHtml.split(/<\/section>/i);
  for (const seg of segments) {
    const plain = stripTagsToText(seg)
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!plain) continue;
    const oneLine = plain.replace(/\n+/g, " ").trim();
    if (shouldMarkAsFigureCaption(seg, plain)) {
      chunks.push(`> 图注：${oneLine}`);
    } else {
      chunks.push(emitParagraphOrMetadata(plain, oneLine));
    }
  }
}

/** 将 `#js_content` 内层 HTML 转为 Markdown：图注（灰字）、阶段性小标题（蓝粗 `##`）、其余段落。 */
function jsContentInnerToMarkdown(innerHtml: string): string {
  const cleaned = innerHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = pRe.exec(cleaned)) !== null) {
    const gap = cleaned.slice(last, m.index);
    pushGapChunks(chunks, gap);
    const inner = m[1];
    const plain = stripTagsToText(inner)
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!plain) {
      last = pRe.lastIndex;
      continue;
    }
    const oneLine = plain.replace(/\n+/g, " ").trim();
    if (shouldMarkAsFigureCaption(inner, plain)) {
      chunks.push(`> 图注：${oneLine}`);
    } else if (isWeChatSectionSubheading(inner)) {
      chunks.push(`## ${oneLine}`);
    } else {
      chunks.push(emitParagraphOrMetadata(plain, oneLine));
    }
    last = pRe.lastIndex;
  }
  pushGapChunks(chunks, cleaned.slice(last));
  return chunks.join("\n\n");
}

function pushEngagementYaml(
  headerLines: string[],
  e: WechatEngagementMetrics,
): void {
  if (e.stats_read !== undefined) headerLines.push(`stats_read: ${e.stats_read}`);
  if (e.stats_old_like !== undefined) {
    headerLines.push(`stats_old_like: ${e.stats_old_like}`);
  }
  if (e.stats_like !== undefined) headerLines.push(`stats_like: ${e.stats_like}`);
  if (e.stats_share !== undefined) {
    headerLines.push(`stats_share: ${e.stats_share}`);
  }
  if (e.stats_comment !== undefined) {
    headerLines.push(`stats_comment: ${e.stats_comment}`);
  }
  if (e.stats_collect !== undefined) {
    headerLines.push(`stats_collect: ${e.stats_collect}`);
  }
  if (e.stats_fetched_at) {
    headerLines.push(`stats_fetched_at: ${yamlDoubleQuotedScalar(e.stats_fetched_at)}`);
  }
  if (e.stats_fetch_error) {
    headerLines.push(
      `stats_fetch_error: ${yamlDoubleQuotedScalar(e.stats_fetch_error)}`,
    );
  }
}

const STRIP_FOOTER_UI_ONLY_PATTERNS: RegExp[] = [
  /预览时标签不可点[\s\S]*$/i,
  /Scan to Follow[\s\S]*$/i,
  /继续滑动看下一个[\s\S]*$/i,
  /\[Got It\][\s\S]*$/i,
  /Scan with Weixin[\s\S]*$/i,
];

/** 清洗为段落文本，可选文件头元信息 */
export function cleanWeChatArticleRaw(
  raw: string,
  meta?: {
    sourceUrl?: string;
    fetchedAt?: string;
    /** 与 inbox 文件名一致，用于 `kb_wechat_id` 短链兜底 */
    slugHint?: string;
    /** 为 true 时仅裁上述「壳子」尾部，仍保留版权声明/阅读原文/转载说明等 */
    stripFooterPatterns?: boolean;
    /** 由 `fetchWechatEngagementStats` 填入（需 `--fetch-stats` + Cookie）；可留空，后续按 `kb_wechat_id` 补录 */
    engagement?: WechatEngagementMetrics;
    /** 额外写入 YAML 的字段（显式阶段元数据） */
    extraYamlFields?: Record<string, string | boolean | number | undefined>;
  },
): string {
  const inner = extractJsContentHtml(raw);
  const base = inner ?? raw;
  let text = inner ? jsContentInnerToMarkdown(inner) : stripTagsToText(base);

  if (meta?.stripFooterPatterns) {
    for (const re of STRIP_FOOTER_UI_ONLY_PATTERNS) {
      text = text.replace(re, "");
    }
  }

  text = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const wx = extractWechatArticleMeta(raw);
  const explicitStyleVariant =
    typeof meta?.extraYamlFields?.wechat_style_variant === "string" ?
      meta.extraYamlFields.wechat_style_variant
    : undefined;
  const wechatStyleVariant = explicitStyleVariant ?? inferWechatStyleVariant(wx.mp_name);
  const kbWechatId = computeKbWechatId(raw, {
    sourceUrl: meta?.sourceUrl,
    slugHint: meta?.slugHint,
  });
  const headerLines: string[] = ["---", "source: wechat_mp_article"];
  headerLines.push(`kb_wechat_id: ${yamlDoubleQuotedScalar(kbWechatId)}`);
  if (meta?.sourceUrl) headerLines.push(`url: ${meta.sourceUrl}`);
  if (meta?.fetchedAt) headerLines.push(`fetchedAt: ${meta.fetchedAt}`);
  if (wx.title) headerLines.push(`title: ${yamlDoubleQuotedScalar(wx.title)}`);
  if (wx.is_original !== undefined) {
    headerLines.push(`is_original: ${wx.is_original}`);
  }
  if (wx.editor) headerLines.push(`editor: ${yamlDoubleQuotedScalar(wx.editor)}`);
  if (wx.mp_name) headerLines.push(`mp_name: ${yamlDoubleQuotedScalar(wx.mp_name)}`);
  if (wechatStyleVariant) {
    headerLines.push(`wechat_style_variant: ${wechatStyleVariant}`);
  }
  if (wx.published_at) {
    headerLines.push(`published_at: ${yamlDoubleQuotedScalar(wx.published_at)}`);
  }
  if (wx.published_at_cn) {
    headerLines.push(`published_at_cn: ${yamlDoubleQuotedScalar(wx.published_at_cn)}`);
  }
  if (meta?.engagement) {
    pushEngagementYaml(headerLines, meta.engagement);
  }
  if (meta?.extraYamlFields) {
    for (const [key, value] of Object.entries(meta.extraYamlFields)) {
      if (value === undefined) continue;
      if (key === "wechat_style_variant" && explicitStyleVariant) continue;
      if (typeof value === "string") {
        headerLines.push(`${key}: ${yamlDoubleQuotedScalar(value)}`);
      } else {
        headerLines.push(`${key}: ${String(value)}`);
      }
    }
  }
  headerLines.push("---", "");

  return `${headerLines.join("\n")}${text}\n`;
}
