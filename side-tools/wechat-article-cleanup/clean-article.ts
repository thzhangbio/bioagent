/**
 * 将 inbox 中的原始 HTML（或纯文本）整理为适合 RAG / 编辑的 Markdown 取向纯文本。
 * 抽取优先：`#js_content` 正文区（嵌套 div 深度扫描）；失败则退化为去标签草稿。
 */

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
  s = s.replace(/<\/div>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return s;
}

/**
 * 仅当 `stripFooterPatterns === true` 时应用：去掉微信页里偏「壳子」的尾部（预览提示、英文关注引导等）。
 * 默认不裁文末，以便保留运营话术、版权声明、转载说明等——写作时经常要对齐或改写自家声明。
 * （若需更强裁剪，在编辑器里手工删。）
 */
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
    /** 为 true 时仅裁上述「壳子」尾部，仍保留版权声明/阅读原文/转载说明等 */
    stripFooterPatterns?: boolean;
  },
): string {
  const inner = extractJsContentHtml(raw);
  const base = inner ?? raw;
  let text = stripTagsToText(base);

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

  const headerLines: string[] = ["---", "source: wechat_mp_article"];
  if (meta?.sourceUrl) headerLines.push(`url: ${meta.sourceUrl}`);
  if (meta?.fetchedAt) headerLines.push(`fetchedAt: ${meta.fetchedAt}`);
  headerLines.push("---", "");

  return `${headerLines.join("\n")}${text}\n`;
}
