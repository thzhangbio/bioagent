/**
 * MinerU 稿在 {@link cleanPdfTextMd} 前后的知识库专用规则。
 */

import { cleanPdfTextMd, type CleanupOptions } from "./cleanup.js";

function collapseSpacedChars(fragment: string): string {
  return fragment.replace(/\s+/g, "");
}

function isCdLikeToken(collapsed: string): boolean {
  return (
    /^CD[0-9]+[a-z]?$/i.test(collapsed) &&
    collapsed.length >= 3 &&
    collapsed.length <= 10
  );
}

export function dropMineruMarkdownNoise(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^\(legend continued on next page\)\s*$/i.test(t)) continue;
    if (/^#\s*Cancer Cell\s*$/i.test(t)) continue;
    if (/^#\s*Article\s*$/i.test(t)) continue;
    if (/^May 11, 2026\s+\$?\\?circledcirc/i.test(t)) continue;
    if (/^https:\/\/doi\.org\/10\.1016\/j\.ccell\.2026\.03\.004\s*$/i.test(t))
      continue;
    out.push(line);
  }
  return out.join("\n");
}

/**
 * MinerU 导出中整段 `<table>…</table>`（试剂表等）对向量检索噪声大；转为 `[表格]` + `|` 分隔的纯文本行。
 */
function flattenOneTableBlock(tableHtml: string): string {
  const rowMatches = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const lines: string[] = [];
  for (const row of rowMatches) {
    const cellMatches =
      row.match(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi) ?? [];
    const parts: string[] = [];
    for (const cell of cellMatches) {
      const inner = cell
        .replace(/^<t[hd]\b[^>]*>/i, "")
        .replace(/<\/t[hd]>$/i, "");
      const plain = inner
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (plain) parts.push(plain);
    }
    if (parts.length) lines.push(parts.join(" | "));
  }
  if (lines.length === 0) return "";
  return `\n[表格]\n${lines.join("\n")}\n`;
}

export function flattenHtmlTablesToPlain(text: string): string {
  let s = text;
  let guard = 0;
  while (/<table\b/i.test(s) && guard++ < 2000) {
    s = s.replace(/<table\b[^>]*>[\s\S]*?<\/table>/i, (m) => {
      const flat = flattenOneTableBlock(m);
      return flat || "\n<!-- 空表格已省略 -->\n";
    });
  }
  return s;
}

export function normalizeMineruInlineLatex(text: string): string {
  let s = text;

  s = s.replace(/\$\s*(\d+)\s*\\\s*%\s*\$/g, "$1%");
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\\s*%\s*\$/g,
    (_, raw: string) => `${collapseSpacedChars(raw)}%`,
  );
  s = s.replace(/\$\s*(\d+)\s*%\s*\$/g, "$1%");

  s = s.replace(/\$\s*\\circledcirc\s*\$/g, "©");
  s = s.replace(/\$\s*∘\s*\$/g, "");

  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\$/gi,
    "mm²",
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\$/gi,
    (_, raw: string) => `${collapseSpacedChars(raw)} mm²`,
  );
  s = s.replace(
    /\(\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\)/gi,
    "(mm²)",
  );

  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\}\s*\^\s*\{\s*((?:\d\s*)+)\}\s*\$/g,
    (full, body: string, supRaw: string) => {
      const base = collapseSpacedChars(body);
      const sup = collapseSpacedChars(supRaw);
      if (!/^\d{1,3}$/.test(sup) || base.length < 2 || base.length > 12)
        return full;
      const supMap: Record<string, string> = {
        "32": "³²",
        "1": "¹",
        "2": "²",
        "3": "³",
      };
      return `${base}${supMap[sup] ?? `^${sup}`}`;
    },
  );

  /** `${ \mathsf { C X C L 1 3 } } ^ { + }$` 等：体须含数字（CXCL13），故用 [A-Za-z0-9] */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const t = collapseSpacedChars(body);
      if (/^[A-Z]{2,8}\d{0,2}$/i.test(t) || /^CXCL\d+$/i.test(t))
        return `${t}+`;
      return full;
    },
  );

  s = s.replace(/\$\s*\\mathsf\s*\{\s*T\s*\}\s*=\s*\$/gi, "T =");

  /** `${ \mathsf { C D } } 1 9 ^ { + }$` → CD19+ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*\}\s*((?:\d\s*)+)\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    (full, digits: string) => {
      const n = collapseSpacedChars(digits);
      return /^\d{1,3}$/.test(n) ? `CD${n}+` : full;
    },
  );

  s = s.replace(
    /TGF\s*\$\s*\\mathrm\s*\{\s*\\Delta\s*\\ddot\s*\{\s*\\beta\s*\}\s*\}\s*\$/gi,
    "TGFβ",
  );

  s = s.replace(
    /transforming growth factor\s*\$\s*\\beta\s*\(\s*\\mathsf\s*\{\s*T\s*G\s*F\s*\}\s*\\beta\s*\)\s*\$/gi,
    "transforming growth factor β (TGFβ)",
  );

  s = s.replace(/\\tt\s*T\s*G\s*F\s*\\beta\s*1?/gi, (m) =>
    m.includes("1") ? "TGFβ1" : "TGFβ",
  );

  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const t = collapseSpacedChars(body);
      if (/^[A-Z]{2,6}$/i.test(t) || /^PDPN$/i.test(t)) return `${t}+`;
      return full;
    },
  );

  s = s.replace(
    /\$\s*\\scriptstyle\s*\\mathtt\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const tok = collapseSpacedChars(body);
      return isCdLikeToken(tok) ? `${tok}+` : full;
    },
  );
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const tok = collapseSpacedChars(body);
      return isCdLikeToken(tok) ? `${tok}+` : full;
    },
  );

  s = s.replace(
    /\$\s*\\boldsymbol\s*\{\s*\\mathsf\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const tok = collapseSpacedChars(body);
      return isCdLikeToken(tok) ? `${tok}+` : full;
    },
  );

  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*T\s*L\s*S\s*\}\s*\}\s*\^\s*\{\s*([+\-−])\s*\}\s*\$/g,
    (_, sup: string) => `TLS${sup === "+" ? "+" : "−"}`,
  );

  /** `${ \mathsf { T G F } } { \mathsf { \beta } }` → TGFβ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*T\s*G\s*F\s*\}\s*\}\s*\{\s*\\mathsf\s*\{\s*\\beta\s*\}\s*\}\s*\$/gi,
    "TGFβ",
  );

  /** 行内纯数字的 `$5 0$`、`$1 2$` → 数字（须在百分号等规则之后） */
  s = s.replace(/\$\s*((?:\d\s*){1,14})\s*\$/g, (full, raw: string) => {
    const n = collapseSpacedChars(raw);
    return /^\d+$/.test(n) ? n : full;
  });

  /** OCR：连续 `\mu` 污染 */
  s = s.replace(/(?:\\mu\s*){3,}/g, "μ");

  /** 裸 `\mathsf { … } ^{+}`（非美元块）常见于图注 */
  s = s.replace(
    /\\mathsf\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*\+\s*\}/g,
    (full, body: string) => {
      const t = collapseSpacedChars(body);
      if (/^CD\d+/i.test(t) || /^CXCL\d+/i.test(t) || /^PDPN$/i.test(t))
        return `${t}+`;
      return full;
    },
  );

  /** `\mathtt { N } = 3 { - } 5` → `N = 3–5` */
  s = s.replace(
    /\\mathtt\s*\{\s*N\s*\}\s*=\s*(\d)\s*\{\s*-\s*\}\s*(\d)/gi,
    "N = $1–$2",
  );

  /** `$5 \mathrm { n g / m L }$` 类浓度 */
  s = s.replace(
    /\$\s*(\d+)\s*\\mathrm\s*\{\s*n\s*g\s*\/\s*m\s*L\s*\}\s*\$/gi,
    "$1 ng/mL",
  );

  /** `$1 \mu g / \mathrm { m L }$`、`\mathsf { m L }`（OCR 空格） */
  s = s.replace(
    /\$\s*(\d+)\s*\\mu\s*\\?\s*g\s*\/\s*\\(?:mathrm|mathsf)\s*\{\s*m\s*L\s*\}\s*\$/gi,
    "$1 μg/mL",
  );

  /** `$10 \mu \mathsf { M }$`、`$1 0 \mu \mathsf { M }$` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*\\mathsf\s*\{\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μM` : full;
    },
  );

  /** `$T _ { \mathsf { H } }` → TH（辅助性 T 细胞下标） */
  s = s.replace(/\$\s*T\s*_\s*\{\s*\\mathsf\s*\{\s*H\s*\}\s*\}/gi, "T_H");

  /** `T_H \mathsf { 1 }$` 被拆成两段时的拼接 */
  s = s.replace(/T_H\s*\\mathsf\s*\{\s*1\s*\}\s*\$/gi, "TH1");

  /** `\mathsf { C D 9 0 . 2 ^ { + } }` 等小数字编号 */
  s = s.replace(
    /\\mathsf\s*\{\s*C\s*D\s*((?:\d\s*)+\s*\.\s*(?:\d\s*)+)\s*\^\s*\{\s*\+\s*\}\s*\}/gi,
    (full, raw: string) => {
      const t = collapseSpacedChars(raw);
      return /^\d+\.\d+$/.test(t) ? `CD${t}+` : full;
    },
  );

  /** `$\pm { \mathsf { C D } } 4 ^ { + } / { \mathsf { C D } } 8 ^ { + }$` */
  s = s.replace(
    /\$\s*\\pm\s*\{\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*\}\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\/\s*\{\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*\}\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "± CD$1+/CD$2+",
  );

  /** `${ \mathsf { C D } } 8 +$`（参考文献等） */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*\}\s*(\d+)\s*\+\s*\$/gi,
    (_, n: string) => `CD${n}+`,
  );

  /** `${ \mathsf { r C A F } } +` */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*r\s*C\s*A\s*F\s*\}\s*\}\s*\+/gi,
    "rCAF+",
  );

  /** OCR 将 `g` 识成 `\rho` 的浓度 */
  s = s.replace(
    /\$\s*(\d+)\s*\\mu\s*\\rho\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\$/gi,
    "$1 μg/mL",
  );

  /** `\mathsf { C D a ^ { + } / C D b ^ { + } }`（须先于单标记 `CDn+`） */
  s = s.replace(
    /\\mathsf\s*\{\s*C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\/\s*C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\}/gi,
    "CD$1+/CD$2+",
  );

  /** `\mathsf { C D n ^ { + } }` 无外层 `$` 时 */
  s = s.replace(
    /\\mathsf\s*\{\s*C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\}/gi,
    "CD$1+",
  );

  /** `\mathtt { C D n ^ { + } }` */
  s = s.replace(
    /\\mathtt\s*\{\s*C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*\}/gi,
    "CD$1+",
  );

  /** `\mathrm { ~ h ~ }` 时间占位 */
  s = s.replace(/\^\s*\{\s*2\s*4\s*\\mathrm\s*\{\s*~\s*h\s*~\s*\}\s*\}/gi, "24 h");

  return s;
}

export interface KbCleanupOptions extends CleanupOptions {
  collapseImageBlocks?: boolean;
  maxImagesPerRun?: number;
}

const DEFAULT_KB: KbCleanupOptions = {
  collapseImageBlocks: true,
  maxImagesPerRun: 1,
};

export function collapseImageBlocksForKb(text: string, maxKeep = 1): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (m) {
      const run: string[] = [line];
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === "") {
          j++;
          continue;
        }
        const n = lines[j].match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (!n) break;
        run.push(lines[j]);
        j++;
      }
      if (run.length >= 2) {
        const kept = run.slice(0, maxKeep);
        const omitted = run.length - kept.length;
        out.push(...kept);
        if (omitted > 0) {
          out.push(
            `<!-- 附图省略 ${omitted} 张连续图片链接（共 ${run.length} 张） -->`,
          );
        }
        i = j;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

export function cleanMarkdownForKnowledgeBase(
  raw: string,
  options: KbCleanupOptions = {},
): string {
  const kb = { ...DEFAULT_KB, ...options };
  const { collapseImageBlocks, maxImagesPerRun, ...cleanupOpts } = kb;

  let text = raw.replace(/\r\n/g, "\n");
  text = dropMineruMarkdownNoise(text);
  text = flattenHtmlTablesToPlain(text);
  text = normalizeMineruInlineLatex(text);
  text = cleanPdfTextMd(text, cleanupOpts);

  if (collapseImageBlocks !== false) {
    text = collapseImageBlocksForKb(text, maxImagesPerRun ?? 1);
  }

  return text.trim() + "\n";
}
