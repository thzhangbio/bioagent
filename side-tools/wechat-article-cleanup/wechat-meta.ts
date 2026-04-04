/**
 * 从微信公众号文章页 HTML 抽取运营用元数据（标题、原创、编辑、公众号名、发布时间）。
 * 字段多来自内嵌 `msg_title` / `cgiData` / meta，不依赖浏览器执行 JS。
 */

export interface WechatArticleMeta {
  title?: string;
  /** 是否标为「原创」 */
  is_original?: boolean;
  /** 文首展示的作者/编辑名（如 JY） */
  editor?: string;
  /** 公众号名称 */
  mp_name?: string;
  /** 发布时间 ISO 8601（UTC） */
  published_at?: string;
  /** 发布时间（东八区，便于运营对照微信界面） */
  published_at_cn?: string;
}

function formatPublishedAtCn(d: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const m = pick("month");
  const day = pick("day");
  const hh = pick("hour");
  const mm = pick("minute");
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

/** 供 YAML 双引号字段转义 */
export function yamlDoubleQuotedScalar(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function extractWechatArticleMeta(html: string): WechatArticleMeta {
  const out: WechatArticleMeta = {};

  const msgTitle = html.match(/var msg_title\s*=\s*'([\s\S]*?)'\.html\s*\(/);
  const ogTitle = html.match(
    /<meta\s+property="og:title"\s+content="([^"]*)"/i,
  );
  const titleRaw = msgTitle?.[1] ?? ogTitle?.[1];
  if (titleRaw) out.title = titleRaw.replace(/\\'/g, "'").trim();

  const stat = html.match(/copyright_stat:\s*'(\d+)'/);
  if (stat) {
    out.is_original = stat[1] === "1";
  } else if (/id="copyright_logo"/.test(html)) {
    out.is_original = /id="copyright_logo"[^>]*>[\s\S]*?原创\s*</.test(html);
  }

  const metaAuthor = html.match(/<meta\s+name="author"\s+content="([^"]*)"/i);
  const ogAuthor = html.match(
    /<meta\s+property="og:article:author"\s+content="([^"]*)"/i,
  );
  const authorSpan = html.match(/id="js_author_name_text"[^>]*>([^<]+)</i);
  out.editor =
    metaAuthor?.[1]?.trim() ||
    ogAuthor?.[1]?.trim() ||
    authorSpan?.[1]?.trim();

  const nickDecode = html.match(/nick_name:\s*JsDecode\('([^']*)'\)/);
  const profileA = html.match(
    /id="profileBt"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
  );
  out.mp_name =
    nickDecode?.[1]?.trim() ||
    profileA?.[1]?.replace(/\s+/g, " ").trim();

  const ori = html.match(/ori_create_time:\s*'(\d+)'/);
  const pubInJson = html.match(/"publish_time"\s*:\s*(\d{10,})/);
  const secStr = ori?.[1] ?? pubInJson?.[1];
  if (secStr) {
    const sec = parseInt(secStr, 10);
    if (!Number.isNaN(sec)) {
      const ms = sec < 1e12 ? sec * 1000 : sec;
      const d = new Date(ms);
      out.published_at = d.toISOString();
      out.published_at_cn = formatPublishedAtCn(d);
    }
  }

  return out;
}
