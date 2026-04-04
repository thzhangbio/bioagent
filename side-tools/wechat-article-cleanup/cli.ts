/**
 * 清洗单份 inbox 原始文件 → out/
 *
 * 用法:
 *   pnpm exec tsx side-tools/wechat-article-cleanup/cli.ts inbox/某篇.raw.html [--strip-footer] [--fetch-stats]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchWechatEngagementStats } from "./appmsg-stats.js";
import { cleanWeChatArticleRaw } from "./clean-article.js";
import { slugFromMpArticleUrl } from "./slug.js";
import { extractWechatArticleMeta } from "./wechat-meta.js";
import {
  renameInboxRawToOutBasename,
  slugHintForKbWechat,
  wechatArticleBasename,
} from "./wechat-article-filename.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const stripFooter = argv.includes("--strip-footer");
  const fetchStats = argv.includes("--fetch-stats");
  const positional = argv.filter(
    (a) => a !== "--strip-footer" && a !== "--fetch-stats",
  );
  const arg = positional[0];
  if (!arg) {
    console.error(
      "用法: pnpm exec tsx side-tools/wechat-article-cleanup/cli.ts <inbox/xxx.raw.html> [--strip-footer] [--fetch-stats]",
    );
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), arg);
  const raw = readFileSync(inputPath, "utf-8");
  const inboxBase = basename(arg).replace(/\.raw\.html?$/i, "");
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
      sourceUrl,
      cookie: process.env.WECHAT_MP_COOKIE,
    });
  }
  const cleaned = cleanWeChatArticleRaw(raw, {
    sourceUrl,
    slugHint,
    fetchedAt: new Date().toISOString(),
    stripFooterPatterns: stripFooter,
    engagement,
  });

  const outDir = join(__dirname, "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${outBase}.md`);
  writeFileSync(outPath, cleaned, "utf-8");
  console.log(`已写入: ${outPath}`);
  renameInboxRawToOutBasename(inputPath, inboxBase, outBase);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
