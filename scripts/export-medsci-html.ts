import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type DocItem = {
  index: number;
  url: string;
  slug: string;
};

const DOCS: DocItem[] = [
  {
    index: 1,
    url: "https://feishu.cn/docx/LW2BdGmZQoFnoIxOzgTcXqCCnhh",
    slug: "depression-epigenetic-aging",
  },
  {
    index: 2,
    url: "https://feishu.cn/docx/K8kJdfGGHo9Cfpxos46ch24ynpb",
    slug: "congo-monkeypox-lineages",
  },
  {
    index: 3,
    url: "https://feishu.cn/docx/S7t3dv83GohkztxpL3ac0AUNno2",
    slug: "wes-pediatric-lupus",
  },
  {
    index: 4,
    url: "https://feishu.cn/docx/Ho4cdv2zqo49cExthnccdyaench",
    slug: "runx-thermogenesis-obesity",
  },
  {
    index: 5,
    url: "https://feishu.cn/docx/OBiOdQl7JoSYB1xEsmucfbptnAd",
    slug: "islet-organoid-hypoxia-angiogenesis",
  },
  {
    index: 6,
    url: "https://feishu.cn/docx/TWEOdQxfkoQaJNxqxKbcDV8pn8b",
    slug: "brachio-cervical-inflammatory-myopathy",
  },
  {
    index: 7,
    url: "https://feishu.cn/docx/Y72FdfD3ToUVicxrruUcqmYrnff",
    slug: "linc00607-flt1-splicing",
  },
  {
    index: 8,
    url: "https://feishu.cn/docx/ZA4XdDMwAol0EvxhmB8cQVzNnKc",
    slug: "pancreatic-cancer-myofibroblast-immunity",
  },
  {
    index: 9,
    url: "https://feishu.cn/docx/MXX1dUpp1oLaxJxX2uVcew72nLf",
    slug: "radiotherapy-aav-immunotherapy",
  },
];

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "table"; rows: string[][] };

function fetchMarkdown(docUrl: string): { title: string; markdown: string } {
  const raw = execFileSync(
    "lark-cli",
    ["docs", "+fetch", "--as", "bot", "--doc", docUrl],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw);
  return {
    title: parsed.data.title as string,
    markdown: parsed.data.markdown as string,
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function parseTable(lines: string[], start: number): { block: Block; next: number } {
  const rows: string[][] = [];
  let i = start;
  while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
    const parts = lines[i]
      .trim()
      .slice(1, -1)
      .split("|")
      .map((s) => s.trim());
    rows.push(parts);
    i += 1;
  }
  if (rows.length >= 2 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) {
    rows.splice(1, 1);
  }
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
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case "h1":
      return `<h1 class="article-title">${inlineFormat(block.text)}</h1>`;
    case "h2":
      return `<h2 class="section-title">${inlineFormat(block.text)}</h2>`;
    case "h3":
      return `<h3 class="subsection-title">${inlineFormat(block.text)}</h3>`;
    case "p":
      return `<p class="article-paragraph">${inlineFormat(block.text)}</p>`;
    case "ul":
      return `<ul class="article-list">${block.items
        .map((item) => `<li>${inlineFormat(item)}</li>`)
        .join("")}</ul>`;
    case "ol":
      return `<ol class="article-list article-list-ordered">${block.items
        .map((item) => `<li>${inlineFormat(item)}</li>`)
        .join("")}</ol>`;
    case "blockquote":
      return `<div class="article-reference">${block.lines
        .map((line) => `<p>${inlineFormat(line)}</p>`)
        .join("")}</div>`;
    case "table": {
      const header = block.rows[0] ?? [];
      const body = block.rows.slice(1);
      return [
        `<div class="table-wrap"><table class="article-table">`,
        `<thead><tr>${header.map((cell) => `<th>${inlineFormat(cell)}</th>`).join("")}</tr></thead>`,
        `<tbody>${body
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${inlineFormat(cell)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody>`,
        `</table></div>`,
      ].join("");
    }
  }
}

function renderHtml(title: string, blocks: Block[]): string {
  const body = blocks
    .filter((block) => block.type !== "h1")
    .map(renderBlock)
    .join("\n");
  const first = blocks.find((block) => block.type === "h1");
  const displayTitle = first?.type === "h1" ? first.text : title;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    :root {
      --page-bg: #f4f4f4;
      --card-bg: #ffffff;
      --title-color: rgba(0, 0, 0, 0.9);
      --body-color: #595959;
      --meta-color: #8c8c8c;
      --accent: #3573b9;
      --line: #e8e8e8;
      --shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
      --content-width: 720px;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top right, rgba(53,115,185,.08), transparent 24%),
        linear-gradient(180deg, #fafafa 0%, var(--page-bg) 100%);
      color: var(--body-color);
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
    }

    .page {
      max-width: 880px;
      margin: 0 auto;
      padding: 40px 20px 72px;
    }

    .article {
      max-width: var(--content-width);
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 36px 28px 48px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
      color: var(--meta-color);
      font-size: 14px;
      letter-spacing: .02em;
    }

    .brand-badge {
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(53,115,185,.1);
      color: var(--accent);
      font-weight: 600;
    }

    .article-title {
      margin: 0 0 16px;
      font-size: 22px;
      line-height: 1.4;
      font-weight: 500;
      color: var(--title-color);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      margin-bottom: 28px;
      font-size: 13px;
      color: var(--meta-color);
    }

    .hero-divider {
      height: 1px;
      margin: 0 0 24px;
      background: linear-gradient(90deg, rgba(53,115,185,.18), rgba(53,115,185,0));
    }

    .article-paragraph,
    .article-list,
    .article-reference p {
      margin: 0 8px 24px;
      font-size: 15px;
      line-height: 1.75;
      letter-spacing: 0.5px;
      color: var(--body-color);
      text-align: justify;
    }

    .article-paragraph strong,
    .article-list strong,
    .article-reference strong {
      color: var(--title-color);
      font-weight: 700;
    }

    .section-title {
      margin: 34px 8px 18px;
      font-size: 21px;
      line-height: 1.5;
      color: var(--accent);
      font-weight: 700;
    }

    .subsection-title {
      margin: 28px 8px 16px;
      font-size: 18px;
      line-height: 1.6;
      color: var(--title-color);
      font-weight: 700;
    }

    .article-list {
      padding-left: 1.4em;
    }

    .article-list li {
      margin-bottom: 10px;
    }

    .article-reference {
      margin: 34px 8px 0;
      padding: 18px 18px 2px;
      border-left: 4px solid rgba(53,115,185,.38);
      background: linear-gradient(180deg, rgba(53,115,185,.06), rgba(53,115,185,.02));
      border-radius: 0 14px 14px 0;
    }

    .article-reference p:first-child {
      color: var(--accent);
      font-weight: 700;
    }

    .table-wrap {
      margin: 28px 8px;
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fcfcfc;
    }

    .article-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 520px;
    }

    .article-table th,
    .article-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      line-height: 1.7;
      vertical-align: top;
    }

    .article-table th {
      background: rgba(53,115,185,.07);
      color: var(--title-color);
      font-weight: 700;
    }

    .footer-note {
      margin: 36px 8px 0;
      padding-top: 18px;
      border-top: 1px dashed rgba(53,115,185,.22);
      font-size: 13px;
      line-height: 1.8;
      color: var(--meta-color);
    }

    @media (max-width: 720px) {
      .page { padding: 20px 12px 48px; }
      .article { padding: 24px 16px 36px; border-radius: 18px; }
      .article-title { font-size: 26px; }
      .section-title { font-size: 20px; }
      .subsection-title { font-size: 17px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <article class="article">
      <div class="brand">
        <span class="brand-badge">梅斯学术风格</span>
        <span>基于真实微信样式复刻生成</span>
      </div>
      <h1 class="article-title">${inlineFormat(displayTitle)}</h1>
      <div class="meta">
        <span>来源：文献知识库内容生成</span>
        <span>版式参考：梅斯学术微信公众号</span>
      </div>
      <div class="hero-divider"></div>
      ${body}
      <div class="footer-note">
        本 HTML 为本地高保真版式交付，用于补足飞书 docx 在复杂公众号样式复现上的限制。
      </div>
    </article>
  </main>
</body>
</html>
`;
}

function main(): void {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const outDir = join(process.cwd(), "output", "medsci-html", stamp);
  mkdirSync(outDir, { recursive: true });

  for (const item of DOCS) {
    const fetched = fetchMarkdown(item.url);
    const blocks = parseMarkdown(fetched.markdown);
    const html = renderHtml(fetched.title, blocks);
    const filename = `${String(item.index).padStart(2, "0")}-${item.slug}.html`;
    writeFileSync(join(outDir, filename), html, "utf8");
    console.log(`${filename}\t${fetched.title}`);
  }
}

main();
