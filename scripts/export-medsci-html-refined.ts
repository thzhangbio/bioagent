import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type DocItem = {
  index: number;
  url: string;
  slug: string;
};

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "table"; rows: string[][] };

function execLarkJson(args: string[]): any {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = execFileSync("lark-cli", args, {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      return JSON.parse(raw);
    } catch (error) {
      lastErr = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600 * (attempt + 1));
    }
  }
  throw lastErr;
}

const DOCS: DocItem[] = [
  { index: 1, url: "https://feishu.cn/docx/LW2BdGmZQoFnoIxOzgTcXqCCnhh", slug: "depression-epigenetic-aging" },
  { index: 2, url: "https://feishu.cn/docx/K8kJdfGGHo9Cfpxos46ch24ynpb", slug: "congo-monkeypox-lineages" },
  { index: 3, url: "https://feishu.cn/docx/S7t3dv83GohkztxpL3ac0AUNno2", slug: "wes-pediatric-lupus" },
  { index: 4, url: "https://feishu.cn/docx/Ho4cdv2zqo49cExthnccdyaench", slug: "runx-thermogenesis-obesity" },
  { index: 5, url: "https://feishu.cn/docx/OBiOdQl7JoSYB1xEsmucfbptnAd", slug: "islet-organoid-hypoxia-angiogenesis" },
  { index: 6, url: "https://feishu.cn/docx/TWEOdQxfkoQaJNxqxKbcDV8pn8b", slug: "brachio-cervical-inflammatory-myopathy" },
  { index: 7, url: "https://feishu.cn/docx/Y72FdfD3ToUVicxrruUcqmYrnff", slug: "linc00607-flt1-splicing" },
  { index: 8, url: "https://feishu.cn/docx/ZA4XdDMwAol0EvxhmB8cQVzNnKc", slug: "pancreatic-cancer-myofibroblast-immunity" },
  { index: 9, url: "https://feishu.cn/docx/MXX1dUpp1oLaxJxX2uVcew72nLf", slug: "radiotherapy-aav-immunotherapy" },
];

function fetchMarkdown(docUrl: string): { title: string; markdown: string } {
  const parsed = execLarkJson(["docs", "+fetch", "--as", "bot", "--doc", docUrl]);
  return { title: parsed.data.title as string, markdown: parsed.data.markdown as string };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCnDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

function decodeEntities(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function italicizeGeneLikeTerms(html: string): string {
  const deny = new Set([
    "DNA",
    "RNA",
    "SLE",
    "JSLE",
    "HUVEC",
    "SCID",
    "STZ",
    "GDS-15",
    "GAI-20",
    "PCR",
    "RNA-SEQ",
    "SNATAC-SEQ",
    "SCRNA-SEQ",
  ]);
  return html.replace(/\b(?:[A-Z]{2,}[0-9][A-Z0-9/-]*|LINC[0-9]{3,8}|sFLT1)\b/g, (token) => {
    if (deny.has(token.toUpperCase())) return token;
    return `<em>${token}</em>`;
  });
}

function inlineFormat(text: string): string {
  const escaped = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return italicizeGeneLikeTerms(escaped);
}

function parseLarkTableFromParagraph(text: string): Block | null {
  const decoded = decodeEntities(text).trim();
  if (!decoded.startsWith("<lark-table")) return null;
  const rowMatches = [...decoded.matchAll(/<lark-tr>([\s\S]*?)<\/lark-tr>/g)];
  const rows = rowMatches.map((match) =>
    [...match[1].matchAll(/<lark-td>([\s\S]*?)<\/lark-td>/g)].map((cell) =>
      cell[1].replace(/\s+/g, " ").trim(),
    ),
  );
  if (!rows.length) return null;
  return { type: "table", rows };
}

function parseTable(lines: string[], start: number): { block: Block; next: number } {
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
    rows.push(
      lines[i]
        .trim()
        .slice(1, -1)
        .split("|")
        .map((s) => s.trim()),
    );
    i += 1;
  }
  if (rows.length >= 2 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) rows.splice(1, 1);
  return { block: { type: "table", rows }, next: i };
}

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const parsed = parseTable(lines, i);
      blocks.push(parsed.block);
      i = parsed.next;
      continue;
    }
    if (/^>\s*/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s*/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", lines: buf });
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^-\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith("# ") ||
        next.startsWith("## ") ||
        next.startsWith("### ") ||
        /^>\s*/.test(next) ||
        /^-\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^\|.*\|$/.test(next)
      ) break;
      para.push(next);
      i += 1;
    }
    const text = para.join(" ");
    const table = parseLarkTableFromParagraph(text);
    blocks.push(table ?? { type: "p", text });
  }

  return blocks;
}

function splitLeadAndReferences(blocks: Block[]): { lead: Block[]; body: Block[]; references: Block[] } {
  const body = [...blocks];
  const lead: Block[] = [];
  const references: Block[] = [];

  while (body.length && body[0]?.type === "p" && lead.length < 3) {
    lead.push(body.shift() as Block);
  }

  while (body.length) {
    const last = body[body.length - 1];
    if (last.type === "blockquote") {
      references.unshift(body.pop() as Block);
      continue;
    }
    break;
  }

  return { lead, body, references };
}

function normalizeReferenceLines(lines: string[]): string[] {
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return [];
  return joined
    .replace(/\[参考资料\]/g, "参考资料：")
    .replace(/\[文献\]\s*/g, "")
    .split(/(?=参考资料：|\[\d+\])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderTable(rows: string[][]): string {
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  return [
    `<section class="wechat-table-wrap"><table class="wechat-table">`,
    `<thead><tr>${header.map((cell) => `<th>${inlineFormat(cell)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineFormat(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    `</table></section>`,
  ].join("");
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case "h1":
      return `<h1 class="wechat-title">${inlineFormat(block.text)}</h1>`;
    case "h2":
      return `<section class="wechat-section-pair"><p class="wechat-section-top">${inlineFormat(block.text)}</p></section>`;
    case "h3":
      return `<section class="wechat-section-pair"><p class="wechat-section-bottom">${inlineFormat(block.text)}</p></section>`;
    case "p":
      return `<p class="wechat-p">${inlineFormat(block.text)}</p>`;
    case "ul":
      return `<ul class="wechat-list">${block.items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol class="wechat-list wechat-list-ordered">${block.items.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ol>`;
    case "blockquote":
      return `<section class="wechat-reference">${normalizeReferenceLines(block.lines)
        .map((line) => `<p>${inlineFormat(line)}</p>`)
        .join("")}</section>`;
    case "table":
      return renderTable(block.rows);
  }
}

function renderHtml(title: string, blocks: Block[]): string {
  const first = blocks.find((block) => block.type === "h1");
  const displayTitle = first?.type === "h1" ? first.text : title;
  const rest = blocks.filter((block) => block.type !== "h1");
  const { lead, body, references } = splitLeadAndReferences(rest);

  const metaDate = formatCnDate();

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    :root {
      --page-bg: #f4f4f4;
      --paper: #ffffff;
      --text: #595959;
      --strong: rgba(0, 0, 0, 0.9);
      --blue: #3573b9;
      --meta: #8c8c8c;
      --line: #ececec;
      --shadow: 0 10px 30px rgba(0,0,0,.06);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page-bg);
      color: var(--text);
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
    }
    .wx-page {
      width: min(100%, 720px);
      margin: 0 auto;
      background: var(--paper);
      min-height: 100vh;
      box-shadow: var(--shadow);
      padding: 24px 14px 48px;
    }
    .wx-header {
      width: min(100%, 677px);
      margin: 0 auto 22px;
    }
    .wx-account {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 auto 26px;
      font-size: 13px;
      color: var(--meta);
      width: min(100%, 677px);
      flex-wrap: wrap;
    }
    .wx-original {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(53,115,185,.1);
      color: var(--blue);
      font-size: 12px;
      font-weight: 700;
    }
    .wx-name {
      color: var(--blue);
      font-weight: 600;
    }
    .wechat-title {
      width: min(100%, 677px);
      margin: 0 auto 12px;
      font-size: 22px;
      line-height: 1.4;
      font-weight: 500;
      color: var(--strong);
    }
    .wx-time {
      width: min(100%, 677px);
      margin: 0 auto 26px;
      color: var(--meta);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .wx-author {
      color: #9a9a9a;
    }
    .wx-content {
      width: min(100%, 677px);
      margin: 0 auto;
    }
    .wechat-p,
    .wechat-list,
    .wechat-reference p {
      margin: 0 8px 24px;
      line-height: 1.75em;
      text-align: justify;
      font-size: 15px;
      letter-spacing: 0.5px;
      color: var(--text);
    }
    .wechat-p strong,
    .wechat-list strong,
    .wechat-reference strong {
      font-weight: 700;
      color: var(--strong);
    }
    .wechat-lead .wechat-p:first-child {
      margin-top: 6px;
    }
    .wechat-section-pair {
      margin: 28px 0 20px;
    }
    .wechat-section-top,
    .wechat-section-bottom {
      margin: 0 8px;
      text-align: center;
      color: var(--blue);
      font-weight: 700;
      letter-spacing: 0.4px;
    }
    .wechat-section-top {
      font-size: 15px;
      line-height: 1.75em;
    }
    .wechat-section-bottom {
      margin-top: 4px;
      font-size: 16px;
      line-height: 1.75em;
    }
    .wechat-list {
      padding-left: 1.5em;
    }
    .wechat-list li {
      margin-bottom: 10px;
    }
    .wechat-table-wrap {
      margin: 28px 8px;
      overflow-x: auto;
      border: 1px solid var(--line);
      background: #fff;
    }
    .wechat-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 520px;
    }
    .wechat-table th,
    .wechat-table td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.7;
      text-align: left;
      vertical-align: top;
      color: var(--text);
    }
    .wechat-table th {
      color: var(--strong);
      background: #fafcff;
    }
    .wechat-reference {
      margin: 34px 8px 0;
      padding: 18px 18px 20px;
      background: #f3f3f3;
      border-radius: 0;
    }
    .wechat-reference p {
      margin-bottom: 10px;
      color: #707070;
      text-align: left;
    }
    .wechat-reference p:first-child {
      color: #7a7a7a;
      font-weight: 400;
    }
    .wx-foot {
      width: min(100%, 677px);
      margin: 34px auto 0;
      padding-top: 16px;
      border-top: 1px dashed rgba(53,115,185,.22);
      color: var(--meta);
      font-size: 12px;
      line-height: 1.8;
    }
    @media (max-width: 720px) {
      .wx-page {
        width: 100%;
        box-shadow: none;
        padding: 20px 8px 40px;
      }
      .wechat-title { font-size: 22px; }
    }
  </style>
</head>
<body>
  <main class="wx-page">
    <header class="wx-header">
      <h1 class="wechat-title">${inlineFormat(displayTitle)}</h1>
      <div class="wx-account">
        <span class="wx-original">原创</span>
        <span class="wx-author">文献知识库生成</span>
        <span class="wx-name">梅斯学术</span>
        <span>${metaDate}</span>
      </div>
    </header>
    <article class="wx-content">
      <section class="wechat-lead">
        ${lead.map(renderBlock).join("\n")}
      </section>
      ${body.map(renderBlock).join("\n")}
      ${references.map(renderBlock).join("\n")}
    </article>
    <footer class="wx-foot">
      本地 HTML 精修版，目标是更接近真实梅斯学术微信单页的阅读节奏、标题样式与正文密度。
    </footer>
  </main>
</body>
</html>`;
}

function main(): void {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const outDir = join(process.cwd(), "output", "medsci-html-refined-v2", stamp);
  mkdirSync(outDir, { recursive: true });

  for (const item of DOCS) {
    const fetched = fetchMarkdown(item.url);
    const blocks = parseMarkdown(fetched.markdown);
    const html = renderHtml(fetched.title, blocks);
    const name = `${String(item.index).padStart(2, "0")}-${item.slug}.html`;
    writeFileSync(join(outDir, name), html, "utf8");
    console.log(`${name}\t${fetched.title}`);
  }
}

main();
