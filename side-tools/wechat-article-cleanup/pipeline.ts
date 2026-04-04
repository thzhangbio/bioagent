/**
 * 从 `links.txt` 拉取微信公众号文章 → `inbox/*.raw.html`；
 * 再自 inbox 清洗 → `out/*.md`。
 *
 * 用法（仓库根）:
 *   pnpm run wechat-article-pipeline           # fetch + clean
 *   pnpm run wechat-article-pipeline -- --fetch-only
 *   pnpm run wechat-article-pipeline -- --clean-only
 *   pnpm run wechat-article-pipeline -- --clean-only --strip-footer  # 可选：仅裁 App/预览类尾部，保留版权声明等
 *   pnpm run wechat-article-pipeline -- --clean-only --fetch-stats   # 尝试拉阅读/点赞等（需 WECHAT_MP_COOKIE）
 *
 * 抓取可能遇到验证页；可将浏览器中「另存」或复制的 HTML 放入 `inbox/` 后 `--clean-only`。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchWechatEngagementStats } from "./appmsg-stats.js";
import { cleanWeChatArticleRaw } from "./clean-article.js";
import { fetchWeChatArticleRaw } from "./fetch.js";
import { parseLinksFile } from "./parse-links.js";
import { slugFromMpArticleUrl } from "./slug.js";
import { extractWechatArticleMeta } from "./wechat-meta.js";
import {
  renameInboxRawToOutBasename,
  slugHintForKbWechat,
  wechatArticleBasename,
} from "./wechat-article-filename.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const LINKS_FILE = join(ROOT, "links.txt");
const INBOX = join(ROOT, "inbox");
const OUT = join(ROOT, "out");

async function runFetch(): Promise<void> {
  if (!existsSync(LINKS_FILE)) {
    console.error(`缺少 ${LINKS_FILE}（可从 links.example.txt 复制）`);
    process.exit(1);
  }
  if (!readFileSync(LINKS_FILE, "utf-8").trim()) {
    console.warn(`空文件: ${LINKS_FILE}（请每行一条 mp 链接）`);
    return;
  }
  const links = parseLinksFile(readFileSync(LINKS_FILE, "utf-8"));
  if (links.length === 0) {
    console.warn("links.txt 中无有效 URL（请取消注释并填入 mp.weixin.qq.com 链接）");
    return;
  }
  mkdirSync(INBOX, { recursive: true });
  for (const url of links) {
    const urlSlug = slugFromMpArticleUrl(url);
    if (!urlSlug) {
      console.warn(`跳过（非微信公众号文章 URL）: ${url}`);
      continue;
    }
    try {
      const r = await fetchWeChatArticleRaw(url);
      const wx = extractWechatArticleMeta(r.body);
      const base = wechatArticleBasename(wx.mp_name, wx.title, urlSlug);
      const path = join(INBOX, `${base}.raw.html`);
      const header = `<!-- source: ${url}\n     fetchedAt: ${new Date().toISOString()}\n     httpStatus: ${r.status}\n     contentType: ${r.contentType}\n-->\n`;
      writeFileSync(path, header + r.body, "utf-8");
      console.log(`已写入 raw: ${path} (${r.body.length} 字符)`);
    } catch (e) {
      console.error(`抓取失败 ${url}:`, e);
    }
  }
}

async function runClean(
  stripFooter: boolean,
  fetchStats: boolean,
): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(INBOX).filter(
    (f) => f.endsWith(".raw.html") || f.endsWith(".raw.htm"),
  );
  if (files.length === 0) {
    console.warn(`inbox 内无 .raw.html；请将抓取结果或另存 HTML 放入 ${INBOX}`);
    return;
  }
  const cookie = process.env.WECHAT_MP_COOKIE;
  if (fetchStats && !cookie) {
    console.warn(
      "已指定 --fetch-stats 但未设置环境变量 WECHAT_MP_COOKIE；互动数据可能无法返回（请在已登录微信的浏览器中打开 mp 文章页，从开发者工具复制 Cookie）",
    );
  }
  for (const f of files) {
    const inboxBase = basename(f).replace(/\.raw\.html?$/i, "");
    const raw = readFileSync(join(INBOX, f), "utf-8");
    const wx = extractWechatArticleMeta(raw);
    const urlMatch = raw.match(/<!--\s*source:\s*([^\n]+)/);
    const sourceUrl = urlMatch?.[1]?.trim();
    const urlSlug = sourceUrl ? slugFromMpArticleUrl(sourceUrl) : null;
    const fallbackSlug = urlSlug ?? inboxBase;
    const outBase = wechatArticleBasename(wx.mp_name, wx.title, fallbackSlug);
    const slugHint = slugHintForKbWechat(raw, inboxBase);
    let engagement: Awaited<
      ReturnType<typeof fetchWechatEngagementStats>
    > | undefined;
    if (fetchStats) {
      engagement = await fetchWechatEngagementStats(raw, {
        sourceUrl: sourceUrl || undefined,
        cookie,
      });
      if (engagement.stats_fetch_error) {
        console.warn(`${outBase}: 互动数据 ${engagement.stats_fetch_error}`);
      }
    }
    const cleaned = cleanWeChatArticleRaw(raw, {
      sourceUrl: sourceUrl || undefined,
      slugHint,
      fetchedAt: new Date().toISOString(),
      stripFooterPatterns: stripFooter,
      engagement,
    });
    const outPath = join(OUT, `${outBase}.md`);
    writeFileSync(outPath, cleaned, "utf-8");
    console.log(`已写入: ${outPath}`);
    const inboxPath = join(INBOX, f);
    renameInboxRawToOutBasename(inboxPath, inboxBase, outBase);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fetchOnly = args.includes("--fetch-only");
  const cleanOnly = args.includes("--clean-only");
  const stripFooter = args.includes("--strip-footer");
  const fetchStats = args.includes("--fetch-stats");

  if (cleanOnly) {
    await runClean(stripFooter, fetchStats);
    return;
  }
  if (fetchOnly) {
    await runFetch();
    return;
  }
  await runFetch();
  await runClean(stripFooter, fetchStats);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
