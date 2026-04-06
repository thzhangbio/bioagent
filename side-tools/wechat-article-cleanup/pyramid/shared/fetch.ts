/**
 * 抓取微信公众号文章页原始响应（通常为 HTML）。
 * 注意：部分环境会返回「环境异常」验证页，需浏览器会话或人工粘贴至 inbox。
 */
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface FetchWeChatRawResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

export async function fetchWeChatArticleRaw(
  url: string,
  init?: RequestInit,
): Promise<FetchWeChatRawResult> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(init?.headers as Record<string, string>),
    },
    ...init,
  });
  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "text/plain";
  return {
    url,
    finalUrl: res.url,
    status: res.status,
    contentType: ct,
    body: text,
  };
}
