import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

type Identity = "bot" | "user";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "image"; src: string; width?: string; height?: string; align?: string };

type RenderOptions = {
  docUrl: string;
  slug: string;
  outDir: string;
  identity: Identity;
  standalone: boolean;
};

function parseArgs(argv: string[]): RenderOptions {
  let docUrl = "";
  let slug = "";
  let outDir = "output/medsci-html-final";
  let identity: Identity = "bot";
  let standalone = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--doc") docUrl = argv[++i] ?? "";
    else if (arg === "--slug") slug = argv[++i] ?? "";
    else if (arg === "--out-dir") outDir = argv[++i] ?? outDir;
    else if (arg === "--as") {
      const v = (argv[++i] ?? "bot").trim();
      identity = v === "user" ? "user" : "bot";
    } else if (arg === "--standalone") standalone = true;
  }

  if (!docUrl.trim()) {
    throw new Error("缺少 --doc");
  }
  if (!slug.trim()) {
    throw new Error("缺少 --slug");
  }

  return {
    docUrl: docUrl.trim(),
    slug: slug.trim(),
    outDir: outDir.trim(),
    identity,
    standalone,
  };
}

function execJson(args: string[], cwd?: string): any {
  const raw = execFileSync("lark-cli", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function fetchDoc(docUrl: string, identity: Identity): { title: string; markdown: string } {
  const parsed = execJson(["docs", "+fetch", "--as", identity, "--doc", docUrl]);
  if (!parsed?.ok) {
    throw new Error(parsed?.error?.message ?? "飞书文档抓取失败");
  }
  return {
    title: String(parsed.data.title ?? "").trim(),
    markdown: String(parsed.data.markdown ?? "").replace(/\r\n/g, "\n"),
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

function parseLarkTableFromParagraph(text: string): Block | null {
  const decoded = text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .trim();
  if (!decoded.startsWith("<lark-table")) return null;
  const rowMatches = [...decoded.matchAll(/<lark-tr>([\s\S]*?)<\/lark-tr>/g)];
  const rows = rowMatches.map((match) =>
    [...match[1].matchAll(/<lark-td>([\s\S]*?)<\/lark-td>/g)].map((cell) =>
      cell[1].replace(/\s+/g, " ").trim(),
    ),
  );
  return rows.length ? { type: "table", rows } : null;
}

function downloadMedia(token: string, seq: number, assetDir: string, identity: Identity): string {
  const stem = `${String(seq).padStart(2, "0")}-${token}`;
  const parsed = execJson(
    ["docs", "+media-download", "--as", identity, "--token", token, "--output", stem, "--overwrite"],
    assetDir,
  );
  const savedPath = String(parsed?.data?.saved_path ?? "");
  if (!savedPath) {
    throw new Error(`图片下载失败: ${token}`);
  }
  return savedPath;
}

function parseMarkdown(md: string, assetDir: string, htmlDir: string, identity: Identity): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (!line || line === "---") {
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

    const imageMatch = line.match(
      /^<image token="([^"]+)" width="([^"]+)" height="([^"]+)"(?: align="([^"]+)")?\/>$/,
    );
    if (imageMatch) {
      const [, token, width, height, align] = imageMatch;
      const seq = blocks.filter((b) => b.type === "image").length + 1;
      const savedPath = downloadMedia(token, seq, assetDir, identity);
      blocks.push({
        type: "image",
        src: relative(htmlDir, savedPath),
        width,
        height,
        align: align || "center",
      });
      i += 1;
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      const rows: string[][] = [];
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
      if (rows.length >= 2 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) {
        rows.splice(1, 1);
      }
      blocks.push({ type: "table", rows });
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

    const table = parseLarkTableFromParagraph(line);
    blocks.push(table ?? { type: "p", text: line.replace(/\s+/g, " ").trim() });
    i += 1;
  }

  return blocks.map((block) => {
    if (block.type === "p" && (block.text.startsWith("参考资料：") || block.text.startsWith("[1] "))) {
      return { type: "blockquote", lines: [block.text] } as Block;
    }
    return block;
  });
}

function normalizeReferenceLines(lines: string[]): string[] {
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return [];
  return joined
    .replace(/\[参考资料\]/g, "参考资料：")
    .split(/(?=参考资料：|\[\d+\])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLeadAndReferences(blocks: Block[]): { lead: Block[]; body: Block[]; references: Block[] } {
  const body = [...blocks];
  const lead: Block[] = [];
  const references: Block[] = [];

  while (body.length && body[0]?.type === "p" && lead.length < 4) {
    lead.push(body.shift() as Block);
  }

  while (body.length && body[body.length - 1]?.type === "blockquote") {
    references.unshift(body.pop() as Block);
  }

  return { lead, body, references };
}

function renderTable(rows: string[][]): string {
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  return [
    `<section class="wechat-table-wrap"><table class="wechat-table">`,
    `<thead><tr>${header.map((cell) => `<th>${inlineFormat(cell)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body
      .map((row) => `<tr>${row.map((cell) => `<td>${inlineFormat(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody>`,
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
    case "image":
      return `<figure class="wechat-figure"><img class="wechat-image" src="${escapeHtml(block.src)}" alt="插图" loading="lazy" /></figure>`;
  }
}

function renderHtml(title: string, blocks: Block[]): string {
  const displayTitle = blocks.find((block) => block.type === "h1")?.text ?? title;
  const rest = blocks.filter((block) => block.type !== "h1");
  const { lead, body, references } = splitLeadAndReferences(rest);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(displayTitle)}</title>
  <style>
    :root { --page-bg:#f4f4f4; --paper:#ffffff; --text:#595959; --strong:rgba(0,0,0,.9); --blue:#3573b9; --meta:#8c8c8c; --line:#ececec; --shadow:0 10px 30px rgba(0,0,0,.06); }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--page-bg); color:var(--text); font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei UI","Microsoft YaHei",Arial,sans-serif; }
    .wx-page { width:min(100%,720px); margin:0 auto; background:var(--paper); min-height:100vh; box-shadow:var(--shadow); padding:24px 14px 48px; }
    .wx-header { width:min(100%,677px); margin:0 auto 22px; }
    .wx-account { display:flex; align-items:center; gap:8px; margin:0 auto 26px; font-size:13px; color:var(--meta); width:min(100%,677px); flex-wrap:wrap; }
    .wx-original { display:inline-block; padding:2px 7px; border-radius:999px; background:rgba(53,115,185,.1); color:var(--blue); font-size:12px; font-weight:700; }
    .wx-name { color:var(--blue); font-weight:600; }
    .wx-author { color:#9a9a9a; }
    .wechat-title { width:min(100%,677px); margin:0 auto 12px; font-size:22px; line-height:1.4; font-weight:500; color:var(--strong); }
    .wx-content { width:min(100%,677px); margin:0 auto; }
    .wechat-p, .wechat-list, .wechat-reference p { margin:0 8px 24px; line-height:1.75em; text-align:justify; font-size:15px; letter-spacing:.5px; color:var(--text); }
    .wechat-p strong, .wechat-list strong, .wechat-reference strong { font-weight:700; color:var(--strong); }
    .wechat-lead .wechat-p:first-child { margin-top:6px; }
    .wechat-section-pair { margin:28px 0 20px; }
    .wechat-section-top, .wechat-section-bottom { margin:0 8px; text-align:center; color:var(--blue); font-weight:700; letter-spacing:.4px; }
    .wechat-section-top { font-size:15px; line-height:1.75em; }
    .wechat-section-bottom { margin-top:4px; font-size:16px; line-height:1.75em; }
    .wechat-list { padding-left:1.5em; }
    .wechat-list li { margin-bottom:10px; }
    .wechat-figure { margin:6px 8px 18px; text-align:center; }
    .wechat-image { display:block; width:100%; height:auto; border-radius:0; box-shadow:0 4px 16px rgba(0,0,0,.05); }
    .wechat-figure + .wechat-p { text-align:center; margin-top:0; color:var(--strong); }
    .wechat-figure + .wechat-p strong { color:var(--strong); }
    .wechat-figure + .wechat-p + .wechat-section-pair { margin-top:10px; }
    .wechat-table-wrap { margin:28px 8px; overflow-x:auto; border:1px solid var(--line); background:#fff; }
    .wechat-table { width:100%; border-collapse:collapse; min-width:520px; }
    .wechat-table th, .wechat-table td { border:1px solid var(--line); padding:10px 12px; font-size:13px; line-height:1.7; text-align:left; vertical-align:top; color:var(--text); }
    .wechat-table th { color:var(--strong); background:#fafcff; }
    .wechat-reference { margin:34px 8px 0; padding:18px 18px 20px; background:#f3f3f3; border-radius:0; }
    .wechat-reference p { margin-bottom:10px; color:#707070; text-align:left; }
    .wechat-reference p:first-child { color:#7a7a7a; font-weight:400; }
    .wx-foot { width:min(100%,677px); margin:34px auto 0; padding-top:16px; border-top:1px dashed rgba(53,115,185,.22); color:var(--meta); font-size:12px; line-height:1.8; }
    @media (max-width: 720px) { .wx-page { width:100%; box-shadow:none; padding:20px 8px 40px; } .wechat-title { font-size:22px; } }
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
      </div>
    </header>
    <article class="wx-content">
      <section class="wechat-lead">${lead.map(renderBlock).join("")}</section>
      ${body.map(renderBlock).join("")}
      ${references.map(renderBlock).join("")}
    </article>
    <footer class="wx-foot">本地 HTML 精修版，沿用既有梅斯单页 CSS 模板。</footer>
  </main>
</body>
</html>`;
}

function inlineImagesAsDataUri(htmlPath: string): string {
  let text = readFileSync(htmlPath, "utf8");
  const srcMatches = [...text.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of new Set(srcMatches)) {
    if (/^data:/.test(src)) continue;
    const assetPath = resolve(resolve(htmlPath, ".."), src);
    const ext = extname(assetPath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png"
      : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".gif" ? "image/gif"
      : "application/octet-stream";
    const base64 = readFileSync(assetPath).toString("base64");
    text = text.replaceAll(`src="${src}"`, `src="data:${mime};base64,${base64}"`);
  }
  return text;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(opts.outDir);
  const assetDir = join(outDir, `${opts.slug}-assets`);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(assetDir, { recursive: true });

  const fetched = fetchDoc(opts.docUrl, opts.identity);
  const blocks = parseMarkdown(fetched.markdown, assetDir, outDir, opts.identity);
  const html = renderHtml(fetched.title, blocks);
  const htmlPath = join(outDir, `${opts.slug}.html`);
  writeFileSync(htmlPath, html, "utf8");
  console.log(htmlPath);

  if (opts.standalone) {
    const standalone = inlineImagesAsDataUri(htmlPath);
    const standalonePath = join(outDir, `${opts.slug}-standalone.html`);
    writeFileSync(standalonePath, standalone, "utf8");
    console.log(standalonePath);
  }
}

main();
