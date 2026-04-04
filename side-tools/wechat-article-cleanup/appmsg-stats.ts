/**
 * 微信公众号文章互动数据（阅读 / 点赞 / 在看 / 转发 / 留言 / 收藏）来自接口
 * `POST https://mp.weixin.qq.com/mp/getappmsgext`，**不在**首屏 HTML 里写死。
 * 无微信环境 Cookie 时接口往往不返回 `appmsgstat`，需用 `--fetch-stats` 并配置
 * `WECHAT_MP_COOKIE`（在已登录微信的浏览器中打开该文，从开发者工具复制 Cookie）。
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface WechatEngagementMetrics {
  stats_read?: number;
  /** 「点赞」拇指 */
  stats_old_like?: number;
  /** 「在看」推荐 */
  stats_like?: number;
  stats_share?: number;
  stats_comment?: number;
  stats_collect?: number;
  stats_fetched_at?: string;
  /** 未拿到数据时的原因（仅在有请求时写入 YAML） */
  stats_fetch_error?: string;
}

export interface AppmsgExtJson {
  appmsgstat?: Record<string, unknown>;
  base_resp?: { ret?: number; err_msg?: string };
  [key: string]: unknown;
}

export function extractArticleIdsFromHtml(html: string): {
  biz?: string;
  mid?: string;
  sn?: string;
  idx?: string;
} {
  const biz = html.match(/var biz = "([^"]+)"/)?.[1];
  const sn = html.match(/var sn = "([^"]+)"/)?.[1];
  const mid = html.match(/var mid = "([^"]+)"/)?.[1];
  const idx = html.match(/var idx = "([^"]+)"/)?.[1];
  return { biz, mid, sn, idx };
}

/** 从文章页 URL 查询串解析 pass_ticket、__biz 等（长链接场景） */
export function extractQueryFromSourceUrl(sourceUrl: string): URLSearchParams {
  try {
    return new URL(sourceUrl).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 解析 getappmsgext JSON 中的 appmsgstat（字段名随微信版本略有差异） */
export function parseAppmsgstatToMetrics(json: AppmsgExtJson): WechatEngagementMetrics {
  const st = json.appmsgstat as Record<string, unknown> | undefined;
  if (!st) {
    return {
      stats_fetch_error:
        json.base_resp?.ret !== undefined && json.base_resp.ret !== 0
          ? `base_resp.ret=${json.base_resp.ret}`
          : "no_appmsgstat",
    };
  }
  return {
    stats_read: num(st.read_num ?? st.real_read_num),
    stats_old_like: num(st.old_like_num ?? st.old_like_count),
    stats_like: num(st.like_num ?? st.like_count),
    stats_share: num(st.share_num ?? st.share_count),
    stats_comment: num(st.comment_num ?? st.comment_count),
    stats_collect: num(st.collect_num ?? st.collect_count),
    stats_fetched_at: new Date().toISOString(),
  };
}

export async function fetchWechatEngagementStats(
  html: string,
  opts: { sourceUrl?: string; cookie?: string },
): Promise<WechatEngagementMetrics> {
  const ids = extractArticleIdsFromHtml(html);
  if (!ids.biz || !ids.mid || !ids.sn || !ids.idx) {
    return { stats_fetch_error: "missing_biz_mid_sn_idx_in_html" };
  }

  const q = opts.sourceUrl ? extractQueryFromSourceUrl(opts.sourceUrl) : null;
  const passTicket = q?.get("pass_ticket") ?? "";
  const appmsgToken = q?.get("appmsg_token") ?? "";

  const body = new URLSearchParams();
  body.set("__biz", ids.biz);
  body.set("mid", ids.mid);
  body.set("sn", ids.sn);
  body.set("idx", ids.idx);
  body.set("scene", "0");
  body.set("is_only_read", "1");
  body.set("is_temp_url", "0");
  body.set("appmsg_type", "9");
  body.set("version", "0");
  body.set("is_need_reward", "0");
  body.set("both_ad", "0");
  body.set("reward_uin_count", "0");
  body.set("msg_daily_idx", "1");
  body.set("is_original", "0");
  body.set("read_num", "0");
  body.set("req_id", `${Date.now()}${Math.floor(Math.random() * 1e6)}`);
  if (passTicket) body.set("pass_ticket", passTicket);
  if (appmsgToken) body.set("appmsg_token", appmsgToken);

  const endpoint = "https://mp.weixin.qq.com/mp/getappmsgext?f=json";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: opts.sourceUrl ?? "https://mp.weixin.qq.com/",
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
      body: body.toString(),
    });
    const json = (await res.json()) as AppmsgExtJson;
    return parseAppmsgstatToMetrics(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { stats_fetch_error: msg };
  }
}
