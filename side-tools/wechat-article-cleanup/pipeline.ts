/**
 * 从 `links.txt` 拉取微信公众号文章 → `inbox/*.raw.html`；
 * 再自 inbox 清洗 → `out/*.md`。
 *
 * 用法（仓库根）:
 *   pnpm run wechat-article-pipeline           # fetch + clean
 *   pnpm run wechat-article-pipeline -- --fetch-only
 *   pnpm run wechat-article-pipeline -- --clean-only
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

import { cleanWeChatArticleRaw } from "./clean-article.js";
import { fetchWeChatArticleRaw } from "./fetch.js";
import { parseLinksFile } from "./parse-links.js";
import { slugFromMpArticleUrl } from "./slug.js";

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
    const slug = slugFromMpArticleUrl(url);
    if (!slug) {
      console.warn(`跳过（非微信公众号文章 URL）: ${url}`);
      continue;
    }
    const path = join(INBOX, `${slug}.raw.html`);
    try {
      const r = await fetchWeChatArticleRaw(url);
      const header = `<!-- source: ${url}\n     fetchedAt: ${new Date().toISOString()}\n     httpStatus: ${r.status}\n     contentType: ${r.contentType}\n-->\n`;
      writeFileSync(path, header + r.body, "utf-8");
      console.log(`已写入 raw: ${path} (${r.body.length} 字符)`);
    } catch (e) {
      console.error(`抓取失败 ${url}:`, e);
    }
  }
}

function runClean(): void {
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(INBOX).filter(
    (f) => f.endsWith(".raw.html") || f.endsWith(".raw.htm"),
  );
  if (files.length === 0) {
    console.warn(`inbox 内无 .raw.html；请将抓取结果或另存 HTML 放入 ${INBOX}`);
    return;
  }
  for (const f of files) {
    const slug = basename(f).replace(/\.raw\.html?$/i, "");
    const raw = readFileSync(join(INBOX, f), "utf-8");
    const urlMatch = raw.match(/<!--\s*source:\s*([^\n]+)/);
    const sourceUrl = urlMatch?.[1]?.trim();
    const cleaned = cleanWeChatArticleRaw(raw, {
      sourceUrl: sourceUrl || undefined,
      fetchedAt: new Date().toISOString(),
    });
    const outPath = join(OUT, `${slug}.md`);
    writeFileSync(outPath, cleaned, "utf-8");
    console.log(`已写入: ${outPath}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fetchOnly = args.includes("--fetch-only");
  const cleanOnly = args.includes("--clean-only");

  if (cleanOnly) {
    runClean();
    return;
  }
  if (fetchOnly) {
    await runFetch();
    return;
  }
  await runFetch();
  runClean();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
