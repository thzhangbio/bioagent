/**
 * MinerU 稿在 {@link cleanPdfTextMd} 前后的知识库专用规则。
 */

import { cleanPdfTextMd, type CleanupOptions } from "./cleanup.js";

function collapseSpacedChars(fragment: string): string {
  return fragment.replace(/\s+/g, "");
}

/** `3, 13` → `³,¹³`（作者单位上标） */
function affiliationSuperscriptFromSpacedDigits(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  const m = compact.match(/^(\d+),(\d+)$/);
  if (!m) return null;
  const sup = (d: string) =>
    [...d].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? c).join("");
  return `${sup(m[1])},${sup(m[2])}`;
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
    /** Elsevier 等期刊页眉，MinerU 常插在段中造成「…was [换页] completed…」式断句 */
    if (/^OPEN ACCESS\s*$/i.test(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}

function shouldJoinLineAfterPageNoise(prev: string, next: string): boolean {
  const p = prev.trimEnd();
  const n = next.trimStart();
  if (!p || !n) return false;
  if (/[.!?;:]["')\]\s]*$/.test(p)) return false;
  if (!/^[a-z(\u201c\u2018]/.test(n)) return false;
  return true;
}

/**
 * 去掉 `OPEN ACCESS` 等独立行后，把被页眉打断的同一句接回一行（上一行无句末标点、下一行以小写或左引号开头）。
 */
export function joinLinesBrokenByRemovedPageNoise(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      let k = i + 1;
      while (k < lines.length && lines[k].trim() === "") k++;
      if (
        out.length > 0 &&
        k < lines.length &&
        shouldJoinLineAfterPageNoise(out[out.length - 1], lines[k])
      ) {
        out[out.length - 1] =
          out[out.length - 1].trimEnd() + " " + lines[k].trimStart();
        i = k + 1;
        continue;
      }
    }
    out.push(line);
    i++;
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

/**
 * 剥离 PDF 嵌入的独立十六进制色值（#RRGGBB / #RGB，含 A–F），减轻噪声。
 * 试剂目录保留「Cat #」；粘连的 `Cat#……` 仅在为色值时去掉色块。
 */
export function neutralizeCatalogHashesAndHexColors(text: string): string {
  let s = text;
  s = s.replace(/Cat#([0-9a-fA-F]{6})\b/gi, (_, hex: string) =>
    /[a-fA-F]/.test(hex) ? "Cat" : "Cat # " + hex,
  );
  /** 独立色值；勿动「Cat #…」「Clone: #…」货号（如 Abcam #ab9475） */
  s = s.replace(
    /(?<!(?:Cat|Clone:)\s)#([0-9a-fA-F]{6})(?=\s|[.,;)\]\}]|$)/gi,
    (full, hex: string) => (/[a-fA-F]/.test(hex) ? "" : full),
  );
  s = s.replace(
    /(?<!(?:Cat|Clone:)\s)#([0-9a-fA-F]{3})(?![0-9a-fA-F])(?=\s|[.,;)\]\}]|$)/gi,
    (full, hex: string) => (/[a-fA-F]/.test(hex) ? "" : full),
  );
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

  /** `${ TGFβ}$`、`${ TGFβ }$`（误用 bash 式 `${}`） */
  s = s.replace(/\$\s*\{\s*TGFβ\s*\}\s*\$/g, "TGFβ");

  /** `${ \mathsf{T}}\{\mathsf{L}\}\{\mathsf{S}\}^{13}$` 类分段 TLS */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*T\s*\}\s*\}\s*\{\s*\\mathsf\s*\{\s*L\s*\}\s*\}\s*\{\s*\\mathsf\s*\{\s*S\s*\}\s*\}\s*\^\s*\{\s*((?:\d\s*)+)\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      if (!/^\d{1,4}$/.test(n)) return full;
      return `TLS^${n}`;
    },
  );

  /** 显著性标记：`${ } ^ { \star } p < 0 . 0 5$`、`$^ { \star\star } p < …$` */
  s = s.replace(
    /\$\s*\{\s*\}\s*\^\s*\{\s*((?:\\star\s*)+)\}\s*p\s*<\s*((?:[\d\s.])+)\s*\$/gi,
    (full, starsRaw: string, numRaw: string) => {
      const starCount = (starsRaw.match(/\\star/gi) ?? []).length;
      const prefix = "*".repeat(Math.min(Math.max(starCount, 1), 5));
      const num = collapseSpacedChars(numRaw);
      if (!/^\d+\.\d+$/.test(num)) return full;
      return `${prefix}p < ${num}`;
    },
  );
  s = s.replace(
    /\$\s*\^\s*\{\s*((?:\\star\s*)+)\}\s*p\s*<\s*((?:[\d\s.])+)\s*\$/gi,
    (full, starsRaw: string, numRaw: string) => {
      const starCount = (starsRaw.match(/\\star/gi) ?? []).length;
      const prefix = "*".repeat(Math.min(Math.max(starCount, 1), 5));
      const num = collapseSpacedChars(numRaw);
      if (!/^\d+\.\d+$/.test(num)) return full;
      return `${prefix}p < ${num}`;
    },
  );

  /** `$p < 0 . 0 5$`（句内显著性，无 star） */
  s = s.replace(
    /\$\s*p\s*<\s*((?:[\d\s.])+)\s*\$/gi,
    (full, numRaw: string) => {
      const num = collapseSpacedChars(numRaw);
      if (!/^\d+\.\d+$/.test(num)) return full;
      return `p < ${num}`;
    },
  );

  /** `TG $\mathrm { \ddot { \beta } }$` → TGFβ */
  s = s.replace(
    /TG\s*\$\s*\\mathrm\s*\{\s*\\ddot\s*\{\s*\\beta\s*\}\s*\}\s*\$/gi,
    "TGFβ",
  );

  /** `$\mathsf { h } = \#$`（h 为 n 的误识；`\#` 表示「数量」） */
  s = s.replace(/\$\s*\\mathsf\s*\{\s*h\s*\}\s*=\s*\\#\s*\$/g, "n = #");
  s = s.replace(/\\mathsf\s*\{\s*h\s*\}\s*=\s*\\#/g, "n = #");

  /** `$(mm²) $ )` 多余 `)` */
  s = s.replace(/\(\s*mm²\s*\)\s*\$\s*\)/g, "(mm²)");

  return s;
}

/**
 * `\mathsf { A ^ { + } B ^ { - } … }` 链式上标（仅一层 `{…}` 嵌套）→ `A+B−…` 可读文本。
 * 含下标 `_ { … }` 的块不处理，避免误伤。
 */
function collapseMathsfSuperscriptChainInner(inner: string): string | null {
  const t = inner.replace(/\s+/g, " ").trim();
  if (t.length > 200) return null;
  if (/_\s*\{/.test(t)) return null;
  if (!/\^\s*\{/.test(t)) return null;

  const pieces: string[] = [];
  let remaining = t;
  const supRe = /^(.+?)\^\s*\{\s*([+\-−–])\s*\}\s*/;
  while (remaining.length > 0) {
    const m = remaining.match(supRe);
    if (m) {
      const base = collapseSpacedChars(m[1].trim());
      const sign = m[2] === "+" || m[2] === "＋" ? "+" : "−";
      if (!base) return null;
      pieces.push(base + sign);
      remaining = remaining.slice(m[0].length).trim();
    } else {
      const tail = collapseSpacedChars(remaining.trim());
      if (tail) pieces.push(tail);
      break;
    }
  }
  if (pieces.length === 0) return null;
  return pieces.join(" ");
}

/**
 * 在 {@link cleanPdfTextMd} 之后执行：把仍残留的「伪公式」统一成正文（面向向量检索，非可逆）。
 */
export function normalizeKbResidualDollarMath(text: string): string {
  let s = text;

  /**
   * KPC 转基因描述：`( P d x \mathcal { I } … p 5 3 ^ … )$` → 短字符串（向量检索用）。
   */
  s = s.replace(
    /\$\s*\(\s*P\s*d\s*x\s*\\mathcal[\s\S]*?\)\s*\$/g,
    "(Pdx1-Cre/LSL-KRas^G12D/LSL-p53^R172H/+)",
  );

  /** `$( T g f b r \mathcal { I } ^ { … tm… } / J )$` 等位基因行 */
  s = s.replace(
    /\$\s*\(\s*T\s*g\s*f\s*b\s*r\s*\\mathcal[\s\S]*?\)\s*\$/g,
    "(Tgfbr1^tm1.1Karl/Kul/J)",
  );

  /** `$A L K 5 ^ { t l / t I }$`、`$\mathsf { A L K 5 } ^ { t l / t 1 }$`（fl 误识为 tl） */
  s = s.replace(
    /\$\s*A\s*L\s*K\s*5\s*\^\s*\{\s*t\s*l\s*\/\s*t\s*I\s*\}\s*\$/gi,
    "ALK5^fl/tI",
  );
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*A\s*L\s*K\s*5\s*\}\s*\^\s*\{\s*t\s*l\s*\/\s*t\s*1\s*\}\s*\$/gi,
    "ALK5^fl/t1",
  );

  /** `LSL-$p 5 3 ^ { R 1 7 2 H / + } )$` p53 行尾碎片 */
  s = s.replace(
    /LSL-\s*\$\s*p\s*5\s*3\s*\^\s*\{\s*R\s*1\s*7\s*2\s*H\s*\/\s*\+\s*\}\s*\)\s*\$/gi,
    "LSL-p53^R172H/+)",
  );

  /** `CXCL $^ { 1 3 + }$` → CXCL13+ */
  s = s.replace(
    /CXCL\s*\$\s*\^\s*\{\s*1\s*3\s*\+\s*\}\s*\$/gi,
    "CXCL13+",
  );

  /** `IF ${ \dot { n } } = 7$`（免疫荧光计数） */
  s = s.replace(
    /\$\s*\{\s*\\dot\s*\{\s*n\s*\}\s*\}\s*=\s*(\d+)\s*\$/g,
    "(n = $1)",
  );

  /** `$_ { \it { n } } = 5$` */
  s = s.replace(
    /\$\s*_\s*\{\s*\\it\s*\{\s*n\s*\}\s*\}\s*=\s*(\d+)\s*\$/gi,
    "(n = $1)",
  );

  /** 畸形 `$( n = 3$`（缺 `)`） */
  s = s.replace(
    /\$\s*\(\s*n\s*=\s*(\d+)\s*\$(?!\s*\))/g,
    "(n = $1)",
  );

  /** OCR：`$C c I2 1 a$` → `Ccl21a`（夹在 Ccl19 / Cxcl13 之间常见） */
  s = s.replace(/\$\s*C\s*c\s*I\s*2\s*1\s*a\s*\$/gi, "Ccl21a");

  /** `$\mathtt { \Gamma } _ { C I 1 9 }$` → Ccl19；`$C x c I 1 3$` → Cxcl13 */
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*\\Gamma\s*\}\s*_\s*\{\s*C\s*I\s*1\s*9\s*\}\s*\$/gi,
    "Ccl19",
  );
  s = s.replace(/\$\s*C\s*x\s*c\s*[Il1]\s*1\s*3\s*\$/gi, "Cxcl13");

  /** `either 1 $\mu \rho / \mathsf { m L }$`（剂量在 `$` 外，须先于 `$\d…\mu` 规则） */
  s = s.replace(
    /\b(\d+)\s+\$\s*\\mu\s*\\rho\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\$/gi,
    "$1 μg/mL",
  );

  /** `1 $\mu \rho / \mathsf { m L }$` → 1 μg/mL（ρ 误识为 g） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\rho\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/mL` : full;
    },
  );

  /** `$N = 3–5$ mice per group as indicated).` → 补全括号样本量 */
  s = s.replace(
    /\$\s*N\s*=\s*((?:\d\s*)+[–-−](?:\s*\d\s*)+)\s*\$\s+mice per group as indicated\)\./gi,
    (_, range: string) =>
      `(n = ${range.replace(/\s+/g, "").replace(/-/g, "–")} mice per group as indicated).`,
  );

  /** `$\lceil n = 8$ mice per group).`（`\lceil` 为 `(` 误识） */
  s = s.replace(
    /\$\s*\\lceil\s*n\s*=\s*((?:\d\s*)+)\s*\$\s*mice per group\)\./gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `(n = ${n} mice per group).` : full;
    },
  );

  /** `$\mathtt { ( C D 4 ^ { + } }$` → `(CD4+` */
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*\(\s*C\s*D\s*4\s*\^\s*\{\s*\+\s*\}\s*\}\s*\$/gi,
    "(CD4+",
  );

  /** `$\scriptstyle ( \mathsf { C D } 8 ^ { + }$` / 多 `}` 的变体 → `(CD8+` */
  s = s.replace(
    /\$\s*\\scriptstyle\s*\(\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*(?:\}\s*)?8\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "(CD8+",
  );

  /** `$\scriptstyle { \mathtt { C D 8 } } ^ { + }$` → CD8+ */
  s = s.replace(
    /\$\s*\\scriptstyle\s*\{\s*\\mathtt\s*\{\s*C\s*D\s*8\s*\}\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "CD8+",
  );

  /** `$\mathsf { n } = 3 { - } 5$` */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*n\s*\}\s*=\s*((?:\d\s*)+)\s*\{\s*-\s*\}\s*((?:\d\s*)+)\s*\$/gi,
    (_, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d+$/.test(x) && /^\d+$/.test(y) ? `n = ${x}–${y}` : `$\\mathsf{n}=${a}{-}${b}$`;
    },
  );

  /** `$PDPN+ CD45- …$` 流式标记串 */
  s = s.replace(
    /\$\s*(PDPN\+\s*CD\d+[\s\-−]+\s*CD\d+[\s\-−]+)\s*\$/gi,
    (_, x: string) => x.replace(/\s+/g, " ").trim(),
  );

  /** `PD $1 ^ { + } CD8+$`（参考文献）→ PD-1+ CD8+ */
  s = s.replace(
    /\bPD\s*\$\s*1\s*\^\s*\{\s*\+\s*\}\s*CD8\+\s*\$/gi,
    "PD-1+ CD8+",
  );

  /** `$( \sim 3 \ – 4)$` → `(~3–4)` */
  s = s.replace(
    /\$\s*\(\s*\\sim\s*((?:[\d\s.])+)\s*\\?\s*[–-−]\s*((?:[\d\s.])+)\s*\)\s*\$/gi,
    (full, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d*\.?\d+$/.test(x) && /^\d*\.?\d+$/.test(y)
        ? `(~${x}–${y})`
        : full;
    },
  );

  /** `${ \mathsf { T N F } } \alpha +`（常与 `$` 混用）→ TNFα+ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*T\s*N\s*F\s*\}\s*\}\s*\\alpha\s*\+/gi,
    "TNFα+",
  );

  /** `METHOD DETAILS $\circ$` → 分隔符 */
  s = s.replace(/METHOD DETAILS\s*\$\s*\\circ\s*\$/g, "METHOD DETAILS ·");

  /** 畸形 `$(mm²)`（仅有开头 `$`、无闭合 `$`）→ `(mm²)` */
  s = s.replace(/\$\s*\(\s*mm²\s*\)(?!\s*\$)/g, "(mm²)");

  /** `$CD4+/CD8+$` → 正文 */
  s = s.replace(
    /\$\s*(CD\d+\s*\+\s*\/\s*CD\d+\s*\+)\s*\$/gi,
    (_, x: string) => x.replace(/\s+/g, ""),
  );

  /** `10– 21)` 等：范围连字符后多余空格（止于右括号前） */
  s = s.replace(/([–-])\s+(\d{1,2})(?=\))/g, "$1$2");

  /** `${ \mathsf { P D } } 1 ^ { + } { \mathsf { T C F } } 1 ^ { + }$` → PD-1+ TCF1+ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*P\s*D\s*\}\s*\}\s*1\s*\^\s*\{\s*\+\s*\}\s*\{\s*\\mathsf\s*\{\s*T\s*C\s*F\s*\}\s*\}\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "PD-1+ TCF1+",
  );

  /** `${ \sim } 2 5 ~ \mathsf { m m } ^ { 2 }$` */
  s = s.replace(
    /\$\s*\{\s*\\sim\s*\}\s*((?:\d\s*)+)\s*~\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `~${n} mm²` : full;
    },
  );

  /** 参考文献等：`PD $1 ^ { + }$`、`TCF $1 ^ { + }$` */
  s = s.replace(/PD\s*\$\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi, "PD-1+");
  s = s.replace(/TCF\s*\$\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi, "TCF1+");

  /** `$5 ~ { \mu \mu }$`（μl 误识） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\{\s*\\mu\s*\\mu\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μl` : full;
    },
  );

  /** 括号前多余空格：`(Figure S1B )` → `(Figure S1B)` */
  s = s.replace(/([A-Za-z0-9])\s+\)/g, "$1)");

  /** `$\pm$` → ± */
  s = s.replace(/\$\s*\\pm\s*\$/g, "±");

  /** 简单时长：`$24 h$`、`$ 2 4 h $` */
  s = s.replace(/\$\s*((?:\d\s*){1,4})\s*h\s*\$/g, (full, raw: string) => {
    const n = collapseSpacedChars(raw);
    return /^\d+$/.test(n) ? `${n} h` : full;
  });

  /** `$CD4+$`、`$CD90.2+$` 等 */
  s = s.replace(
    /\$\s*(CD\d+(?:\.\d+)?\+)\s*\$/gi,
    (_, x: string) => x,
  );

  /** `$( n = 3 )$ )` 重复右括号 */
  s = s.replace(
    /\$\s*\(\s*n\s*=\s*(\d+)\s*\)\s*\$\s*\)/g,
    "(n = $1)",
  );

  /** `$_ { n = 5 }$` 类样本量 */
  s = s.replace(
    /\$\s*_\s*\{\s*n\s*=\s*(\d+)\s*\}\s*\$/g,
    "(n = $1)",
  );

  /** `$\mathsf { C D 4 ^ { + } T _ { H } } 1$` → CD4+ Th1 */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*C\s*D\s*4\s*\^\s*\{\s*\+\s*\}\s*T\s*_\s*\{\s*H\s*\}\s*\}\s*1\s*\$/gi,
    "CD4+ Th1",
  );

  /** `${ \mathsf { T } } _ { \mathsf { H } } { \mathsf { 1 } }$` → TH1 */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*T\s*\}\s*\}\s*_\s*\{\s*\\mathsf\s*\{\s*H\s*\}\s*\}\s*\{\s*\\mathsf\s*\{\s*1\s*\}\s*\}\s*\$/gi,
    "TH1",
  );

  /** `\mathsf { … }` 内仅 `^ { ± }` 链（PDPN+CD45−…） */
  s = s.replace(
    /\\mathsf\s*\{((?:[^{}]|\{[^{}]*\})+)\}/gi,
    (full, inner: string) => {
      const out = collapseMathsfSuperscriptChainInner(inner);
      return out ?? full;
    },
  );

  /**
   * `${ CD… }$` 误用 bash 式 `${}` → 纯文本（须在 `\mathsf{…}` 链式折叠之后执行，否则 inner 含 `\` 会跳过，折叠后留下 `${ CD3+ CD8− }$`）。
   */
  s = s.replace(
    /\$\s*\{\s*([\s\S]*?)\s*\}\s*\$/g,
    (full, inner: string) => {
      const t = inner.trim();
      if (/\\/.test(t)) return full;
      if (!/^CD\d+/i.test(t)) return full;
      if (t.length > 220) return full;
      return t.replace(/\s+/g, " ").trim();
    },
  );

  /** `$( … )$ )`：图注里美元块与右括号重复 */
  s = s.replace(
    /\$\s*\(\s*([^$]+?)\s*\)\s*\$\s*\)/g,
    (full, inner: string) => {
      const t = inner.trim();
      if (/\\/.test(t)) return full;
      return `(${t})`;
    },
  );

  /** `ICAM- $\cdot 1 ^ { + }$`、`PD- $\cdot 1 ^ { + }$`、`VCAM- $\cdot 1 ^ { + }$` */
  s = s.replace(
    /ICAM-\s*\$\s*\\cdot\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "ICAM-1+",
  );
  s = s.replace(
    /PD-\s*\$\s*\\cdot\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "PD-1+",
  );
  s = s.replace(
    /([A-Z][a-z]{1,12})-\s*\$\s*\\cdot\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    (_, name: string) => `${name}-1+`,
  );

  /** `$\mathtt { C D 4 5 ^ { + } }$` → CD45+ */
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*((?:[A-Za-z0-9]\s*)+)\^\s*\{\s*\+\s*\}\s*\}\s*\$/gi,
    (full, body: string) => {
      const t = collapseSpacedChars(body);
      if (/^CD\d+/i.test(t)) return `${t}+`;
      return full;
    },
  );

  /** `$\mathtt { C D 3 ^ { + } C D 8 ^ { - } }$` 双标记 */
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}\s*C\s*D\s*(\d+)\s*\^\s*\{\s*-\s*\}\s*\}\s*\$/gi,
    "CD$1+CD$2−",
  );

  /** `$50 \mu \mathrm { m }$` 比例尺 */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μm` : full;
    },
  );

  /** 浓度碎片：`$15 ~ \mu g / \mathrm { mL } )$ )` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mu\s*\\?\s*g\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*\)\s*\$\s*\)/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/mL` : full;
    },
  );

  /** `scale bars, $100 ~ { \mu \mathrm { m } } )$ )` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\{\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\}\s*\)\s*\$\s*\)/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μm` : full;
    },
  );

  /** `$(mm²)$`、`$( mm² )$` */
  s = s.replace(/\$\s*\(\s*mm²\s*\)\s*\$/g, "(mm²)");

  /** 图注里 `MF $=$` → `MF =` */
  s = s.replace(/\bMF\s*\$\s*=\s*\$/g, "MF =");
  s = s.replace(/\bTCM\s*\$\s*=\s*\$/g, "TCM =");

  /** TGF-β 参考文献/正文碎片（须先于裸 `$\beta$` → Unicode） */
  s = s.replace(
    /TGF\s*-\s*\$\s*\\boldsymbol\s*\{\s*\\cdot\s*\}\s*\\boldsymbol\s*\{\s*\\beta\s*\}\s*\$/gi,
    "TGF-β",
  );
  s = s.replace(/TGF\s*\$\s*\\cdot\s*\\beta\s*\$/gi, "TGF-β");
  s = s.replace(/TGF\s*-\s*\$\s*\\cdot\s*\\beta\s*\$/gi, "TGF-β");
  s = s.replace(/TGF\s+\$\s*\\beta\s*\$/gi, "TGF-β");
  s = s.replace(/TGF\s*-\s*\$\s*\\beta\s*\$/gi, "TGF-β");

  /** `NF- $\cdot \kappa \mathsf { B } \mathsf { 2 }$` → NF-κB2 */
  s = s.replace(
    /NF-\s*\$\s*\\cdot\s*\\kappa\s*\\mathsf\s*\{\s*B\s*\}\s*\\mathsf\s*\{\s*2\s*\}\s*\$/gi,
    "NF-κB2",
  );

  /** `Lymphotoxin $\beta$ receptor` 等 */
  s = s.replace(
    /Lymphotoxin\s+\$\s*\\beta\s*\$\s+receptor/gi,
    "Lymphotoxin β receptor",
  );

  /** `$\mathsf { C D 4 + 7 }$`（OCR 将「CD4+ CD7+」粘连） */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*C\s*D\s*4\s*\+\s*7\s*\}\s*\$/gi,
    "CD4+ CD7+",
  );
  s = s.replace(/\\mathsf\s*\{\s*C\s*D\s*4\s*\+\s*7\s*\}/gi, "CD4+ CD7+");

  /** `anti- $\mathtt { C D 8 \beta }$` */
  s = s.replace(
    /anti-\s*\$\s*\\mathtt\s*\{\s*C\s*D\s*8\s*\\beta\s*\}\s*\$/gi,
    "anti-CD8β",
  );

  /** 剂量：`$150 \mathrm { mg / kg }$`、`$0 . 3 \mathsf { g } / \mathsf { k g }$` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathrm\s*\{\s*m\s*g\s*\/\s*k\s*g\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mg/kg` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\mathsf\s*\{\s*g\s*\}\s*\/\s*\\mathsf\s*\{\s*k\s*g\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} g/kg` : full;
    },
  );

  /** `A p-value $< 0 . 0 5$`、阈值比较式内数字被空格拆开 */
  s = s.replace(
    /\$\s*<\s*((?:\s*\d\s*)+\s*\.\s*(?:\s*\d\s*)+)\s*\$/g,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+\.\d+$/.test(n) ? `< ${n}` : full;
    },
  );

  /** 参考文献 `28,30 word` → `28, 30 word`（缺空格） */
  s = s.replace(/,(\d{2,4}),(\d{2,4})(?=\s+[a-z])/g, ", $1, $2");

  /** `$…$ ,` 图注/基因名后逗号前多余空格 */
  s = s.replace(/\$\s+,/g, "$,");

  /** 英文词与逗号间误插入空格：`Ccl21a ,` → `Ccl21a,` */
  s = s.replace(/([A-Za-z0-9])[ \t]+,/g, "$1,");

  /** `$37 ^ { \circ } \mathrm { C }$`、`$4 ^ { \circ } \mathsf { C }$` → n°C */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\^\s*\{\s*\\circ\s*\}\s*\\(?:mathrm|mathsf)\s*\{\s*C\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n}°C` : full;
    },
  );

  /** `$15 ^ { \circ } \mathrm { C } )$`（磷酸化等：右括号在 `$` 内）→ `15°C)` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\^\s*\{\s*\\circ\s*\}\s*\\(?:mathrm|mathsf)\s*\{\s*C\s*\}\s*\)\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n}°C)` : full;
    },
  );

  /** `$\mathsf { C O } _ { 2 }$` → CO₂ */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*C\s*O\s*\}\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "CO₂",
  );

  /** `${ \mathsf { C O } } _ { 2 }$`（多一层花括号）→ CO₂ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*C\s*O\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "CO₂",
  );

  /** STAR 方法目录：`$\circ$` 与 `○` 统一 */
  s = s.replace(/\$\s*\\circ\s*\$/g, "○");

  /** 品牌名误识：`$1 0 \times$ Genomics` → `10x Genomics` */
  s = s.replace(/\$\s*1\s*0\s*\\times\s*\$\s*Genomics/gi, "10x Genomics");

  /** DNA 甲基化 EpiJET：`$\%$ of 5 $\scriptstyle \mathsf { m C } = … ^ { Cq2 - Cq1 }$` */
  s = s.replace(
    /\$\s*\\%\s*\$\s+of\s+5\s+\$\s*\\scriptstyle\s*\\mathsf\s*\{\s*m\s*C\s*\}\s*=\s*1\s*0\s*0\s*\/\s*\(\s*1\s*\+\s*\\mathsf\s*\{\s*E\s*\}\s*\)\s*\^\s*\{\s*\\mathsf\s*\{\s*C\s*q\s*2\s*\}\s*-\s*\\mathsf\s*\{\s*C\s*q\s*1\s*\}\s*\}\s*\$/gi,
    "% of 5mC = 100/(1+E)^(Cq2−Cq1)",
  );

  /** `$\mathsf { S n C l } _ { 2 }$` → SnCl₂ */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*S\s*n\s*C\s*l\s*\}\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "SnCl₂",
  );

  /** `$1, 5 \mathsf { m g } / \mathsf { m L } \mathsf { S n C l } _ { 2 }$` → `1.5 mg/mL SnCl₂` */
  s = s.replace(
    /\$\s*1\s*,\s*5\s*\\mathsf\s*\{\s*m\s*g\s*\}\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\\mathsf\s*\{\s*S\s*n\s*C\s*l\s*\}\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "1.5 mg/mL SnCl₂",
  );

  /** `$\mathsf { N } _ { 2 }$` → N₂ */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*N\s*\}\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "N₂",
  );

  /** `$1 0 ^ { n }$` / `$10^{n}$`（无系数，MOI、PBMC 等）→ `10^n` */
  s = s.replace(
    /\$\s*(?:1\s*0|10)\s*\^\s*\{\s*(\d+)\s*\}\s*\$/g,
    (_, exp: string) => `10^${exp}`,
  );

  /** ChIP：`$\Delta \mathsf { C t } = \mathsf { C t }$` → `ΔCt = Ct` */
  s = s.replace(
    /\$\s*\\Delta\s*\\mathsf\s*\{\s*C\s*t\s*\}\s*=\s*\\mathsf\s*\{\s*C\s*t\s*\}\s*\$/gi,
    "ΔCt = Ct",
  );

  /** `$n ^ { \circ } \mathsf { C } .$`（离心温度句号在 `$` 内）→ `n°C.` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\^\s*\{\s*\\circ\s*\}\s*\\mathsf\s*\{\s*C\s*\}\s*\.\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n}°C.` : full;
    },
  );

  /** 原稿 `…C .$ .` 在 `$` 外多一个句点 → `…C. ` */
  s = s.replace(/(\d+°C)\.\s+\./g, "$1. ");

  /** RNA-seq：`${ \sf 3 ^ { \prime } }$`（3′ 端）→ `3′` */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*3\s*\^\s*\{\s*\\prime\s*\}\s*\}\s*\$/gi,
    "3′",
  );

  /** radio-TLC：`$( { \mathsf { R } } { \mathsf { f } } { = } 0)$ ),` → `(Rf = 0),` */
  s = s.replace(
    /\$\s*\(\s*\{\s*\\mathsf\s*\{\s*R\s*\}\s*\}\s*\{\s*\\mathsf\s*\{\s*f\s*\}\s*\}\s*\{\s*=\s*\}\s*0\s*\)\s*\$\s*\)\s*,/gi,
    "(Rf = 0),",
  );

  /** `$( \mathsf { R f } = 1)$` → `(Rf = 1)` */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*R\s*f\s*\}\s*=\s*1\s*\)\s*\$/gi,
    "(Rf = 1)",
  );

  /** `$20 \mu \ g$` 等 μg（μ 与 g 间误空格） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*g\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg` : full;
    },
  );

  /** `$50 \mathsf { m } \mathsf { M }$` Tris 等 → mM */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*\}\s*\\mathsf\s*\{\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mM` : full;
    },
  );

  /** `$\textstyle - 8 0 ^ { \circ } \mathsf { C }$` → -80°C */
  s = s.replace(
    /\$\s*\\textstyle\s*-\s*8\s*0\s*\^\s*\{\s*\\circ\s*\}\s*\\mathsf\s*\{\s*C\s*\}\s*\$/gi,
    "-80°C",
  );

  /** 引物 `$5 '$` → 5′ */
  s = s.replace(/\$\s*5\s*'\s*\$/g, "5′");

  /** `$1 . 2 \times 1 0 ^ { 5 }$` 等科学计数（指数为 5） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\times\s*1\s*0\s*\^\s*\{\s*5\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n}×10⁵` : full;
    },
  );

  /** `$5 \times 1 0 ^ { 5 } – 1 \times 1 0 ^ { 6 }$` 细胞数区间 */
  s = s.replace(
    /\$\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*5\s*\}\s*[–-−]\s*1\s*\\times\s*1\s*0\s*\^\s*\{\s*6\s*\}\s*\$/gi,
    "5×10⁵–1×10⁶",
  );

  /** PCR 温度 OCR：`$\mathfrak { s } 5 ^ { \circ } \mathfrak { C }$` → 95°C（s5 → 95） */
  s = s.replace(
    /\$\s*\\mathfrak\s*\{\s*s\s*\}\s*5\s*\^\s*\{\s*\\circ\s*\}\s*\\mathfrak\s*\{\s*C\s*\}\s*\$/gi,
    "95°C",
  );

  /** scRNA：`${ \mathfrak { z } } ^ { \prime }$`（z→3）→ 3′ */
  s = s.replace(
    /\$\s*\{\s*\\mathfrak\s*\{\s*z\s*\}\s*\}\s*\^\s*\{\s*(?:\\prime|')\s*\}\s*\$/gi,
    "3′",
  );

  /** Scanpy 细胞数：`$\scriptstyle ( 1 7 = 4 5, 9 5 8)$ )` → `(n = 45,958)` */
  s = s.replace(
    /\$\s*\\scriptstyle\s*\(\s*1\s*7\s*=\s*4\s*5\s*,\s*9\s*5\s*8\s*\)\s*\$\s*\)/gi,
    "(n = 45,958)",
  );

  /** `$( \mathsf { n } { = } 7, 6 3 5)$` → `(n = 7,635)` */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*n\s*\}\s*\{\s*=\s*\}\s*7\s*,\s*6\s*3\s*5\s*\)\s*\$/gi,
    "(n = 7,635)",
  );

  /** `$( \mathsf { n { = } } 2, 6 3 5 /$ group)` → `(n = 2,635/group)` */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*n\s*\{\s*=\s*\}\s*\}\s*2\s*,\s*6\s*3\s*5\s*\/\s*\$\s*group\)/gi,
    "(n = 2,635/group)",
  );

  /** 异氟烷气体：`$( 2 \%$ in $1 0 0 \% 0 _ { 2 }$ gas)` → `(2% in 100% O₂ gas)`（MinerU 常用 `\%`） */
  s = s.replace(
    /\$\s*\(\s*2\s*\\%\s*\$\s*in\s*\$\s*1\s*0\s*0\s*\\%\s*0\s*_\s*\{\s*2\s*\}\s*\$\s*gas\)/gi,
    "(2% in 100% O₂ gas)",
  );

  /** SPECT 尾静脉剂量行（乱码 N→省略） */
  s = s.replace(
    /\$\s*1\s*1\s*0\s*~\s*\\mu\s*\\mathsf\s*\{\s*L\s*\}\s*\/\s*1\s*1\s*,\s*8\s*\{\s*\\pm\s*\}\s*0\s*,\s*8\s*~\s*\\mathsf\s*\{\s*N\s*\}\s*\$\s*MBq\)/gi,
    "(110 μL; 11.8 ± 0.8 MBq)",
  );

  /** SPECT 瘤内：`$( 40\mu \mathrm { L } / 3, 5 { \pm } 0, 3$ MBq)` */
  s = s.replace(
    /\$\s*\(\s*4\s*0\s*\\mu\s*\\mathrm\s*\{\s*L\s*\}\s*\/\s*3\s*,\s*5\s*\{\s*\\pm\s*\}\s*0\s*,\s*3\s*\$\s*MBq\)/gi,
    "(40 μL; 3.5 ± 0.3 MBq)",
  );

  /** `${ \mathsf { s o m } } _ { \mathsf { T c } }` → 99mTc（衰变校正） */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*s\s*o\s*m\s*\}\s*\}\s*_\s*\{\s*\\mathsf\s*\{\s*T\s*c\s*\}\s*\}\s*\$/gi,
    "99mTc",
  );
  s = s.replace(
    /the\s+\$\s*\{\s*\\mathsf\s*\{\s*s\s*o\s*m\s*\}\s*\}\s*_\s*\{\s*\\mathsf\s*\{\s*T\s*c\s*\}\s*\}\s*\$\s+signal/gi,
    "the 99mTc signal",
  );

  /** 多重免疫：`$CD31+ lCAM+$` → CD31+ ICAM+ */
  s = s.replace(
    /\$\s*C\s*D\s*3\s*1\s*\+\s*l\s*C\s*A\s*M\s*\+\s*\$/gi,
    "CD31+ ICAM+",
  );

  /** `$3 \mu \up$`（up→μL） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\up\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μL` : full;
    },
  );

  /** `$100 \mu \rho \mathsf { B } \mathsf { S }$` → 100 μL PBS */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\rho\s*\\mathsf\s*\{\s*B\s*\}\s*\\mathsf\s*\{\s*S\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μL PBS` : full;
    },
  );

  /** `$100 \mathrm { m m } ^ { 3 }$` 肿瘤体积 */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathrm\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*3\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mm³` : full;
    },
  );

  /** 样品储存：`$\mathfrak { - 8 0 \% }$` → -80°C */
  s = s.replace(
    /\$\s*\\mathfrak\s*\{\s*-\s*8\s*0\s*\\%\s*\}\s*\$/gi,
    "-80°C",
  );

  /** PCR 延伸：`${ 7 2 ^ { \circ } } \mathsf { C }$` → 72°C */
  s = s.replace(
    /\$\s*\{\s*7\s*2\s*\^\s*\{\s*\\circ\s*\}\s*\}\s*\\mathsf\s*\{\s*C\s*\}\s*\$/gi,
    "72°C",
  );

  /** `$10 \mu \ L$` / `$5 \mu \ L$` → μL */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*L\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μL` : full;
    },
  );

  /** PMA/ionomycin：`$0 . 5 \mu \ g / \ m \mu$` → 0.5 μg/ml */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\mu\s*\\?\s*g\s*\/\s*\\?\s*m\s*\\mu\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} μg/ml` : full;
    },
  );

  /** `$50 ~ \mu \mathsf { M }$` → 50 μM */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mu\s*\\mathsf\s*\{\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μM` : full;
    },
  );

  /** `$70 – 9 0 \%$` 类百分比区间 */
  s = s.replace(
    /\$\s*((?:\d\s*)+)[–-−]\s*((?:\d\s*)+)\s*\\?\s*%\s*\$/gi,
    (full, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d+$/.test(x) && /^\d+$/.test(y) ? `${x}–${y}%` : full;
    },
  );

  /** `$+ 5 \mathsf { m g } / \mathsf { m l }$` */
  s = s.replace(
    /\$\s*\+\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*g\s*\}\s*\/\s*\\mathsf\s*\{\s*m\s*l\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mg/ml` : full;
    },
  );

  /** `$5 \times 1 0 \ 3$` → 5×10³ */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\times\s*((?:\d\s*)+)\s*\\?\s*((?:\d\s*)+)\s*\$/gi,
    (full, a: string, b: string, c: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      const z = collapseSpacedChars(c);
      if (/^\d+$/.test(x) && /^\d+$/.test(y) && /^\d+$/.test(z) && y === "10")
        return `${x}×10${z === "3" ? "³" : z === "2" ? "²" : "^" + z}`;
      return full;
    },
  );

  /** `$50 \mu \vert$`（`\vert` 误为 l）→ μl */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\vert\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μl` : full;
    },
  );

  /** `$( < 3 \mathsf { m m } ) $ )` 重复右括号 */
  s = s.replace(
    /\$\s*\(\s*<\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\)\s*\$\s*\)/gi,
    (_, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `(<${n} mm)` : `$\\(<${raw} mm) $ )`;
    },
  );

  /** `$\mathsf { I F N \beta }$` → IFNβ */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*I\s*F\s*N\s*\\beta\s*\}\s*\$/gi,
    "IFNβ",
  );

  /** `$\mathsf { I F N } \gamma$` / `$\mathsf { I F N } \eta$`（η 多为 γ 误识）→ IFNγ */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*I\s*F\s*N\s*\}\s*\\gamma\s*\$/gi,
    "IFNγ",
  );
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*I\s*F\s*N\s*\}\s*\\eta\s*\$/gi,
    "IFNγ",
  );

  /** `$| \mathsf { F N } \gamma$`：`|` 为 I 的误识 */
  s = s.replace(
    /\$\s*\|\s*\\mathsf\s*\{\s*F\s*N\s*\}\s*\\gamma\s*\$/gi,
    "IFNγ",
  );

  /** `depletion with $\mathtt { C D 8 \beta }$`（不限于 anti- 前缀） */
  s = s.replace(
    /\$\s*\\mathtt\s*\{\s*C\s*D\s*8\s*\\beta\s*\}\s*\$/gi,
    "CD8β",
  );

  /** 参考文献：`${ \mathsf { C D 4 + } }$` → CD4+ */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*C\s*D\s*4\s*\+\s*\}\s*\}\s*\$/gi,
    "CD4+",
  );

  /** Prf1 敲除鼠常被拆成 `$P H ^ { - 1 - }$` */
  s = s.replace(/\$\s*P\s*H\s*\^\s*\{\s*-\s*1\s*-\s*\}\s*\$/gi, "Prf1−/−");

  /** 效应 CD8+ T：`$P H ^ { + }$`（穿孔素 Prf1） */
  s = s.replace(/\$\s*P\s*H\s*\^\s*\{\s*\+\s*\}\s*\$/gi, "Prf1+");

  /** 作者行上标 `$^ { 3, 1 3 }$`（逗号两侧数字均可含空格） */
  s = s.replace(
    /\$\s*\^\s*\{\s*([\d\s,]+)\s*\}\s*\$/g,
    (full, raw: string) => {
      const compact = raw.replace(/\s+/g, "");
      return affiliationSuperscriptFromSpacedDigits(compact) ?? full;
    },
  );

  /** Cxcl10、Arg1/Spp1（字母被空格拆开） */
  s = s.replace(
    /\$\s*C\s*x\s*c\s*I\s*1\s*0\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "Cxcl10+",
  );
  s = s.replace(/\$\s*C\s*x\s*c\s*I\s*1\s*0\s*\$/gi, "Cxcl10");
  s = s.replace(
    /\$\s*A\s*r\s*g\s*1\s*\^\s*\{\s*\+\s*\}\s*S\s*p\s*p\s*1\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "Arg1+ Spp1+",
  );

  /** scRNA-seq：`$( I f n g ^ { + }$,` → `(IFNγ+,` */
  s = s.replace(
    /\$\(\s*I\s*f\s*n\s*g\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "(IFNγ+",
  );

  /** `$( S e I I ^ …` → `(Tcf1+`（OCR 将 Tcf1 误为 SeII） */
  s = s.replace(
    /\$\(\s*S\s*e\s*I\s*I\s*\^\s*\{\s*\\mathrm\s*\{\s*~\s*\+\s*~\s*\}\s*\}\s*\$/gi,
    "(Tcf1+",
  );

  /** `$( T o x ~ ^ { + }$,` */
  s = s.replace(
    /\$\(\s*T\s*o\s*x\s*~\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "(Tox+",
  );

  /** `$FASL+ CD \mathsf { 8 } ^ { + }$` */
  s = s.replace(
    /\$FASL\+\s*CD\s*\\mathsf\s*\{\s*8\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "FASL+ CD8+",
  );

  /** 括号内整段基因型：`$( Rag2 ; Il2rg )$` */
  s = s.replace(
    /\$\s*\(\s*R\s*a\s*g\s*2\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*;\s*I\s*I\s*2\s*r\s*g\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\)\s*\$/gi,
    "(Rag2−/−; Il2rg−/−)",
  );

  /** `(B a t f 3 ^ { - / - })` */
  s = s.replace(
    /\(\s*B\s*a\s*t\s*f\s*3\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\)/gi,
    "(Batf3−/−)",
  );

  /** Sting^gt/J + Tmem173（Tmem 常在 `$` 外被拆字） */
  s = s.replace(
    /C57BL\/6J-Sting\s+\$\s*\^\s*\{\s*\\mathfrak\s*\{\s*g\s*t\s*\}\s*\}\s*\/\s*\\mathsf\s*\{\s*J\s*\}\s*\$\s*\(\s*T\s*m\s*e\s*m\s*1\s*7\s*3\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\)/gi,
    "C57BL/6J-Sting^gt/J (Tmem173−/−)",
  );

  /** 游离 `(T m e m 1 7 3 ^ { - / - })` */
  s = s.replace(
    /\(\s*T\s*m\s*e\s*m\s*1\s*7\s*3\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\)/gi,
    "(Tmem173−/−)",
  );

  /** Perforin 品系：`$( \mathsf { C 5 7 B L } / 6 \mathrm { - } \mathsf { P r f 1 } ^ … )$` */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*C\s*5\s*7\s*B\s*L\s*\}\s*\/\s*6\s*\\mathrm\s*\{\s*-\s*\}\s*\\mathsf\s*\{\s*P\s*r\s*f\s*1\s*\}\s*\^\s*\{\s*\\mathrm\s*\{\s*t\s*m\s*1\s*5\s*d\s*z\s*\}\s*\}\s*\/\s*\\mathsf\s*\{\s*J\s*\}\s*\)\s*\$/gi,
    "(C57BL/6-Prf1^tm1Sdz/J)",
  );

  /** 抗生素浓度 OCR：`$100 {\mathfrak{g}}/{\mathfrak{m}}\llcorner$` → μg/mL */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\{\s*\\mathfrak\s*\{\s*g\s*\}\s*\}\s*\/\s*\{\s*\\mathfrak\s*\{\s*m\s*\}\s*\}\s*\\llcorner\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/mL` : full;
    },
  );

  /** `(MO $10^5 )$ )` → `(MOI 10^5)` */
  s = s.replace(
    /\(MO\s+\$\s*((?:\d\s*)+)\s*\^\s*\{\s*5\s*\}\s*\)\s*\$\s*\)/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `(MOI 10^5)` : full;
    },
  );

  /** `GloMa $\circled{8}$` → GloMax®（Promega 读板机） */
  s = s.replace(/GloMa\s*\$\s*\\circled\s*\{\s*8\s*\}\s*\$/gi, "GloMax®");

  /** `$(+/-$ RT but no AAV)` 破损括号 */
  s = s.replace(
    /\$\(\s*\+\s*\/\s*-\s*\$\s*RT but no AAV\)/gi,
    "(+/- RT but no AAV)",
  );

  /** 箱线图：`$\pm 1 0 { - } 9 0 $ percentile` */
  s = s.replace(
    /\$\s*\\pm\s*((?:\d\s*)+)\s*\{\s*-\s*\}\s*((?:\d\s*)+)\s*\$\s*percentile/gi,
    (full, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d+$/.test(x) && /^\d+$/.test(y)
        ? `±${x}–${y}th percentile`
        : full;
    },
  );

  /** `RT $^ +$ AAV` → `RT+ AAV`（MinerU 常见 `$^ +$` 无花括号，或 `$^{+}$`） */
  s = s.replace(
    /\bRT\s+\$\s*\^\s*(?:\{\s*\+\s*\}|\s*\+)\s*\$\s*AAV/gi,
    "RT+ AAV",
  );

  /** `$\mathsf { R T } { + } \mathsf { A A V } { - }$ - iIL12` → RT+AAV-iIL12 */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*R\s*T\s*\}\s*\{\s*\+\s*\}\s*\\mathsf\s*\{\s*A\s*A\s*V\s*\}\s*\{\s*-\s*\}\s*\$\s*-\s*iIL12/gi,
    "RT+AAV-iIL12",
  );

  /** 肿瘤体积：`$1 0 0 ~ \mathsf { m m } ^ { 3 }$`、`$4 0 0 \mathsf { m m } ^ { 3 }$` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*3\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mm³` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\^\s*\{\s*3\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mm³` : full;
    },
  );

  /** `(8 Gy)`：`$( 8 \mathsf { G y } )$ )` 多余 `)` */
  s = s.replace(
    /\$\(\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*G\s*y\s*\}\s*\)\s*\$\s*\)/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `(${n} Gy)` : full;
    },
  );

  /** A-485 抑制剂：`${ \mathsf { A } } – 4 8 5 ^ { 4 4 }$` */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*A\s*\}\s*\}\s*[–-]\s*4\s*8\s*5\s*\^\s*\{\s*4\s*4\s*\}\s*\$/gi,
    "A-485",
  );

  /** `$( \mathsf { C D } 4 5 ^ { + } )$` → `(CD45+)` */
  s = s.replace(
    /\$\(\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*4\s*5\s*\^\s*\{\s*\+\s*\}\s*\)\s*\$/gi,
    "(CD45+)",
  );

  /** `$R a g 2 ^ { - / - }$ ; $I … Il2rg` 极端 LaTeX 垃圾（MC38 人源化段） */
  s = s.replace(
    /\$\s*R\s*a\s*g\s*2\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\$\s*;\s*\$I\s*\{\s*\\cal\s*\{\s*I\s*\}\s*\}[^$]{0,120}\^\s*\{\s*\/\s*-\s*\}\s*\$/gi,
    "Rag2−/−; Il2rg−/−",
  );

  /** `$R a g 2 ^ { - / - } ; I I 2 ^ { - / - }$` → Rag2−/−; Il2rg−/− */
  s = s.replace(
    /\$\s*R\s*a\s*g\s*2\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*;\s*I\s*I\s*2\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\$/gi,
    "Rag2−/−; Il2rg−/−",
  );

  /** 单段基因型：`$R a g 2 ^ { - / - }$` */
  s = s.replace(
    /\$\s*R\s*a\s*g\s*2\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\$/gi,
    "Rag2−/−",
  );

  /** 流式：`$GFP+$` */
  s = s.replace(/\$\s*GFP\+\s*\$/gi, "GFP+");

  /** `$( \mathsf { p g } / \mathsf { m l } )$` */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*p\s*g\s*\}\s*\/\s*\\mathsf\s*\{\s*m\s*l\s*\}\s*\)\s*\$/gi,
    "(pg/ml)",
  );

  /** `$\varnothing 0 ^ { \circ } \mathsf { C }$` → 0°C */
  s = s.replace(
    /\$\s*\\varnothing\s*0\s*\^\s*\{\s*\\circ\s*\}\s*\\mathsf\s*\{\s*C\s*\}\s*\$/gi,
    "0°C",
  );

  /** `${ \sim } 90 \%$`、`${ > } 94 \%$` */
  s = s.replace(
    /\$\s*\{\s*\\sim\s*\}\s*((?:\d\s*)+)\s*\\?\s*%\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `~${n}%` : full;
    },
  );
  s = s.replace(
    /\$\s*\{\s*>\s*\}\s*((?:\d\s*)+)\s*\\?\s*%\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `>${n}%` : full;
    },
  );

  /** `${ \tt6 0 ^ { \circ } C }$` 烘焙温度 */
  s = s.replace(
    /\$\s*\{\s*\\tt\s*6\s*0\s*\^\s*\{\s*\\circ\s*\}\s*C\s*\}\s*\$/gi,
    "60°C",
  );

  /** `${ \mathsf { d o H } } _ { 2 } 0$` → H₂O */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*d\s*o\s*H\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*0\s*\$/gi,
    "H₂O",
  );

  /** `${ \mathfrak { g o o c } }$` 微波温度 OCR 垃圾 → 90°C */
  s = s.replace(/\$\s*\{\s*\\mathfrak\s*\{\s*g\s*o\s*o\s*c\s*\}\s*\}\s*\$/gi, "90°C");

  /** `${ \sf H } _ { 2 } 0 _ { 2 }$` → H₂O₂ */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*0\s*_\s*\{\s*2\s*\}\s*\$/gi,
    "H₂O₂",
  );

  /** `in $40 ~ \mathrm { ml } ~ 70\%$ ethanol` 类 */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mathrm\s*\{\s*m\s*l\s*\}\s*~\s*((?:\d\s*)+)\s*\\?\s*%\s*\$/gi,
    (full, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d+$/.test(x) && /^\d+$/.test(y) ? `${x} ml ${y}%` : full;
    },
  );

  /** `$\sim 1 . 8 \mathsf { m }$` → ~1.8 ml */
  s = s.replace(
    /\$\s*\\sim\s*((?:[\d\s.])+)\s*\\mathsf\s*\{\s*m\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `~${n} ml` : full;
    },
  );

  /** `\mathrm { m g / m ! }`（! 为 l 误识） */
  s = s.replace(/\\mathrm\s*\{\s*m\s*g\s*\/\s*m\s*!\s*\}/gi, "mg/ml");

  /** `$2 . 5 \ : mg/ml$`（`: ` 为 LaTeX 间距） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\?\s*:\s*mg\/ml\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} mg/ml` : full;
    },
  );

  /** `Cultrex BME $( 0 . 1 \mathrm { m g / m l }$ - R&D` */
  s = s.replace(
    /Cultrex BME\s*\$\s*\(\s*((?:[\d\s.])+)\s*\\mathrm\s*\{\s*m\s*g\s*\/\s*m\s*l\s*\}\s*\$\s*-\s*R\&D/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n)
        ? `Cultrex BME (${n} mg/ml - R&D`
        : full;
    },
  );

  /** `$+ 1 . 2 5 \mathrm { m g / m l }$` → + 1.25 mg/ml */
  s = s.replace(
    /\$\s*\+\s*((?:[\d\s.])+)\s*\\mathrm\s*\{\s*m\s*g\s*\/\s*m\s*l\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `+ ${n} mg/ml` : full;
    },
  );

  /** `$+ 5 0 \mathsf { U } / \mathsf { m } \mathsf { l }$ DNase` → + 50 U/ml */
  s = s.replace(
    /\$\s*\+\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*U\s*\}\s*\/\s*\\mathsf\s*\{\s*m\s*\}\s*\\mathsf\s*\{\s*l\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `+ ${n} U/ml` : full;
    },
  );

  /** `$1 0 0 ~ { \mu \mathrm { m } }$` → 100 μm（滤膜孔径） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\{\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μm` : full;
    },
  );

  /** `$15 \mathsf { m } |$` → 15 ml（| 为 l） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*\}\s*\|\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} ml` : full;
    },
  );

  /** `$500 ~ \mu \ g /$ mouse`、`$50 \mu \ g /$ mouse` → μg/mouse */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mu\s*\\?\s*g\s*\/\s*\$\s*mouse/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/mouse` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*g\s*\/\s*\$\s*mouse/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/mouse` : full;
    },
  );

  /** `Th1 $( 5 ~ \mu \varrho / \mathsf { m } \mu$ of each)` */
  s = s.replace(
    /\$\s*\(\s*((?:\d\s*)+)\s*~\s*\\mu\s*\\varrho\s*\/\s*\\mathsf\s*\{\s*m\s*\}\s*\\mu\s*\$\s*of each\)/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `(${n} μg/ml of each)` : full;
    },
  );

  /** `$250 \mathrm { U } / \mathrm { m } |$` → U/ml */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathrm\s*\{\s*U\s*\}\s*\/\s*\\mathrm\s*\{\s*m\s*\}\s*\|\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} U/ml` : full;
    },
  );

  /** `$0 . 2 \mu \mathsf { m }$`、`$3 . 0 \mu \mathrm { m }$`（滤膜孔径） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\mu\s*\\(?:mathsf|mathrm)\s*\{\s*m\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} μm` : full;
    },
  );

  /** `$250 \mu \ g / \mathrm { m } \mu$` 等 μg/ml（末尾 m\\mu 误识） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*g\s*\/\s*\\mathrm\s*\{\s*m\s*\}\s*\\mu\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} μg/ml` : full;
    },
  );

  /** `DNase I $( 50 \mu … / \mathsf { m } μ$ –`（`$` 在 en-dash 前闭合） */
  s = s.replace(
    /DNase I\s*\$\s*\(\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*g\s*\/\s*\\mathsf\s*\{\s*m\s*\}\s*μ\s*\$\s*[–-]/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `DNase I (${n} μg/ml –` : full;
    },
  );

  /** `anti-CCR7 $( 5 ~ \mu \varrho / \mathsf { m } |$ –` */
  s = s.replace(
    /anti-CCR7\s*\$\s*\(\s*((?:\d\s*)+)\s*~\s*\\mu\s*\\varrho\s*\/\s*\\mathsf\s*\{\s*m\s*\}\s*\|\s*\$\s*[–-]/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `anti-CCR7 (${n} μg/ml –` : full;
    },
  );

  /** `anti-LTBR $( 1 \ \mu \mathsf { g } / …$ –`（`1 \ ` 与 `\mu` 间可有 LaTeX `\\ `） */
  s = s.replace(
    /anti-LTBR\s*\$\s*\(\s*((?:\d\s*)+)\s*(?:\\\s+)*\s*\\mu\s*\\mathsf\s*\{\s*g\s*\}\s*\/\s*\\mathsf\s*\{\s*m\s*\}\s*\\mathsf\s*\{\s*l\s*\}\s*\$\s*[–-]/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `anti-LTBR (${n} μg/ml –` : full;
    },
  );

  /** `anti-IL-4 ( $1 0 \mu \ g / \ m \mu$ –` */
  s = s.replace(
    /anti-IL-4\s*\(\s*\$\s*((?:\d\s*)+)\s*\\mu\s*\\?\s*g\s*\/\s*\\?\s*m\s*\\mu\s*\$\s*[–-]/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `anti-IL-4 (${n} μg/ml –` : full;
    },
  );

  /** `$CD90.2− CD19+$`、`$CD19− CD90.2+ CD4− CD8+$` 流式表型串 */
  s = s.replace(
    /\$\s*((?:CD[0-9.]+[+−]\s*)+)\s*\$/gi,
    (_, x: string) => x.replace(/\s+/g, " ").trim(),
  );

  /** E-TLS：`E-TLS score $= 1$`、`$^ { \circ 2 }$` */
  s = s.replace(/E-TLS score\s*\$\s*=\s*1\s*\$/g, "E-TLS score = 1");
  s = s.replace(
    /E-TLS score\s*\$\s*\^\s*\{\s*\\circ\s*2\s*\}\s*\$/gi,
    "E-TLS score = 2",
  );

  /** `aggregates $< 1 0, 0 0 0 \mu \mathrm { m } ^ { 2 } )$` → `aggregates < … μm²)` */
  s = s.replace(
    /aggregates\s*\$\s*<\s*((?:[0-9\s,])+)\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\)\s*\$/gi,
    (full, raw: string) => {
      const n = raw.replace(/\s+/g, "");
      return /^[\d,]+$/.test(n) ? `aggregates < ${n} μm²)` : full;
    },
  );

  /** `between $…{ - }…\ \mu…$`（10,000–25,000 μm²） */
  s = s.replace(
    /between\s*\$\s*((?:[0-9\s,])+)\s*\{\s*-\s*\}\s*((?:[0-9\s,])+)\s*\\\s+\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\)\s*\$/gi,
    (full, a: string, b: string) => {
      const x = a.replace(/\s+/g, "");
      const y = b.replace(/\s+/g, "");
      return /^[\d,]+$/.test(x) && /^[\d,]+$/.test(y)
        ? `between ${x}–${y} μm²)`
        : full;
    },
  );

  /** `(aggregates $> 2 5, 0 0 0 \mu … )$ .` */
  s = s.replace(
    /\(aggregates\s*\$\s*>\s*((?:[0-9\s,])+)\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\)\s*\$/gi,
    (full, raw: string) => {
      const n = raw.replace(/\s+/g, "");
      return /^[\d,]+$/.test(n) ? `(aggregates > ${n} μm²)` : full;
    },
  );

  /** `only aggregates $> 2, 5 0 0 \mu \mathrm { m } ^ { 2 }$ were` */
  s = s.replace(
    /only aggregates\s*\$\s*>\s*((?:[0-9\s,])+)\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = raw.replace(/\s+/g, "");
      return /^[\d,]+$/.test(n) ? `only aggregates > ${n} μm²` : full;
    },
  );

  /** E-TLS 行：`μm²) ),` / `μm²) .` 多余括号（原稿 ` )$ ),` 残留） */
  s = s.replace(/μm²\)\s*\),/g, "μm²),");
  s = s.replace(/μm²\)\s+\./g, "μm²).");

  /** `software at $^ { 2 0 \times }$` → 20× */
  s = s.replace(
    /at\s+\$\s*\^\s*\{\s*((?:\d\s*)+)\s*\\times\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `at ${n}×` : full;
    },
  );

  /** `$1 \times 1 0 ^ { 5 }$` 细胞数 */
  s = s.replace(
    /\$\s*1\s*\\times\s*1\s*0\s*\^\s*\{\s*5\s*\}\s*\$/gi,
    "1×10^5",
  );

  /** `$1 . 5 \%$ agarose` */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\?\s*%\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n}%` : full;
    },
  );

  /** `$( 1 0 0 \% - 7 0 \% )$` 乙醇梯度 */
  s = s.replace(
    /\$\s*\(\s*((?:\d\s*)+)\s*\\?\s*%\s*-\s*((?:\d\s*)+)\s*\\?\s*%\s*\)\s*\$/gi,
    (full, a: string, b: string) => {
      const x = collapseSpacedChars(a);
      const y = collapseSpacedChars(b);
      return /^\d+$/.test(x) && /^\d+$/.test(y) ? `(${x}%–${y}%)` : full;
    },
  );

  /** `$> 1 0 0$ total`、`$> 2 0 0$ microns` */
  s = s.replace(
    /\$\s*>\s*((?:\d\s*)+)\s*\$\s+total\b/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `> ${n} total` : full;
    },
  );
  s = s.replace(
    /\$\s*>\s*((?:\d\s*)+)\s*\$\s+microns\b/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `> ${n} microns` : full;
    },
  );

  /** `${ \ o } = 3$`（E-TLS score 行；`\ o` 为空格命令） */
  s = s.replace(/\$\s*\{\s*\\\s*o\s*\}\s*=\s*(\d+)\s*\$/gi, "(score = $1)");

  /** `$\mathsf { C D } 4 5 ^ { + } \mathsf { C D } 4 ^ { + }$` → 纯文本 */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*4\s*5\s*\^\s*\{\s*\+\s*\}\s*\\mathsf\s*\{\s*C\s*D\s*\}\s*4\s*\^\s*\{\s*\+\s*\}\s*\$/gi,
    "CD45+ CD4+",
  );

  /** 裸 `$\alpha$` `$\beta$` … → Unicode（面向 KB 正文） */
  s = s.replace(
    /\$\s*\\(alpha|beta|gamma|delta|kappa|mu|nu)\s*\$/gi,
    (_, g: string) => {
      const map: Record<string, string> = {
        alpha: "α",
        beta: "β",
        gamma: "γ",
        delta: "δ",
        kappa: "κ",
        mu: "μ",
        nu: "ν",
      };
      return map[g.toLowerCase()] ?? `$\\${g}$`;
    },
  );

  /** `β -mercapto`：`$\beta$` 刚转成 `β` 后常残留空格（须在 Unicode 希腊规则之后） */
  s = s.replace(/([α-ωΑ-Ω])\s*-\s*(?=[a-z])/gi, "$1-");
  s = s.replace(/\u03B2\s*-\s*(?=[a-z])/g, "β-");

  /** `TGF-β -educated` 类：希腊字母与连字符间勿留空格 */
  s = s.replace(/(TGF-β)\s+-\s+/g, "$1-");

  /** 显著性后多余空格：`*p < 0.05 ,` → `*p < 0.05,` */
  s = s.replace(/(\*+p\s*<\s*[\d.]+)\s+,/g, "$1,");
  s = s.replace(/(p\s*<\s*[\d.]+)\s+,/g, "$1,");

  /** `rCAF+$`（残留 `$`）→ `rCAF+` */
  s = s.replace(/rCAF\+\$/g, "rCAF+");

  /** 肿瘤体积公式 `$\mathsf{V}=(4/3)\times\pi\times…$` */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*V\s*\}\s*=\s*\(\s*4\s*\/\s*3\s*\)\s*\\times\s*\\pi\s*\\times\s*\(\s*\\mathsf\s*\{\s*W\s*\}\s*\/\s*2\s*\)\s*\^\s*\{\s*2\s*\}\s*\\times\s*\(\s*\\mathsf\s*\{\s*L\s*\}\s*\/\s*2\s*\)\s*\$/gi,
    "V = (4/3)×π×(W/2)²×(L/2)",
  );

  /** `$100 ~ \mu \mathrm{L}$`（百微升） */
  s = s.replace(
    /\$\s*1\s*0\s*0\s*~\s*\\mu\s*\\mathrm\s*\{\s*L\s*\}\s*\$/gi,
    "100 μL",
  );

  /** `NaCl $0{,}9\%$` → NaCl 0.9% */
  s = s.replace(
    /\bNaCl\s+\$\s*0\s*\{\s*,\s*\}\s*9\s*\\?\s*%\s*\$/gi,
    "NaCl 0.9%",
  );

  /** 高锝酸盐 `$[ { 99 } \mathrm{m}_{TC}]…$` → 可读化学式 */
  s = s.replace(
    /\$\s*\[\s*\{\s*9\s*9\s*\}\s*\\mathrm\s*\{\s*m\s*\}\s*_\s*\{\s*\\mathsf\s*\{\s*T\s*C\s*\}\s*\}\s*\]\s*\\mathsf\s*\{\s*N\s*a\s*\}\s*\\mathsf\s*\{\s*T\s*c\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*\$/gi,
    "[99mTc]NaTcO4",
  );

  /** radio-TLC 游离峰乱码 `$\mathsf{P}^{99m}…NaTcO4$` */
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*P\s*\}\s*\^\s*\{\s*\\mathsf\s*\{\s*9\s*9\s*m\s*\}\s*\}\s*\\mathsf\s*\{\s*T\s*c\s*\}\s*\\mathsf\s*\{\s*J\s*\}\s*\\mathsf\s*\{\s*N\s*a\s*T\s*c\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*\$/gi,
    "[99mTc]NaTcO4",
  );

  /** 人源化：`$(5×10^6$ cells/mouse)` 破损括号 */
  s = s.replace(
    /\$\s*\(\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*6\s*\}\s*\$\s*cells\/mouse\)/gi,
    "(5×10^6 cells/mouse)",
  );

  /** 胶质瘤：`$(5×10^4$ cells per mouse` */
  s = s.replace(
    /\$\s*\(\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*4\s*\}\s*\$\s*cells per mouse/gi,
    "(5×10^4 cells per mouse",
  );

  /** `${\sim}1$ cm` */
  s = s.replace(/\$\s*\{\s*\\sim\s*\}\s*1\s*\$\s*cm/gi, "~1 cm");

  /** 坐标 `$(+2.5 \mathsf{mm}$ lateral, $+1 \mathsf{mm}$ anterior` */
  s = s.replace(
    /\$\s*\(\s*\+\s*2\s*\.\s*5\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\$\s*lateral\s*,\s*\$\s*\+\s*1\s*\\mathsf\s*\{\s*m\s*m\s*\}\s*\$\s*anterior/gi,
    "(+2.5 mm lateral, +1 mm anterior",
  );

  /** `$5×10^10$` 病毒基因组 / `$\mathsf{vg}$` */
  s = s.replace(
    /\$\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*1\s*0\s*\}\s*\$/gi,
    "5×10^10",
  );
  s = s.replace(
    /\$\s*\(\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*1\s*0\s*\}\s*\\mathsf\s*\{\s*v\s*g\s*\}\s*\)\s*\$\s*\)\s*\)/gi,
    "(5×10^10 vg).",
  );
  s = s.replace(
    /\$\s*\(\s*5\s*\\times\s*1\s*0\s*\^\s*\{\s*1\s*0\s*\}\s*\\mathsf\s*\{\s*v\s*g\s*\}\s*\)\s*\$/gi,
    "(5×10^10 vg)",
  );

  /** `$(5×10^10 vg) ).` MinerU 多余右括号 */
  s = s.replace(/\(\s*5×10\^10\s+vg\)\s*\)\s*\./g, "(5×10^10 vg).");

  /** 尾静脉剂量 `$(1×10^11$ vg/mouse)` */
  s = s.replace(
    /\$\s*\(\s*1\s*\\times\s*1\s*0\s*\^\s*\{\s*1\s*1\s*\}\s*\$\s*vg\/mouse\)/gi,
    "(1×10^11 vg/mouse)",
  );

  /** D-luciferin `$(20 \mathrm{mg/mL})$` */
  s = s.replace(
    /\$\s*\(\s*2\s*0\s*\\mathrm\s*\{\s*m\s*g\s*\/\s*m\s*L\s*\}\s*\)\s*\$/gi,
    "(20 mg/mL)",
  );

  /** IVIS：`$( \mathsf{ph}/…$ )`（`$` 在右括号前闭合） */
  s = s.replace(
    /\$\s*\(\s*\\mathsf\s*\{\s*p\s*h\s*\}\s*\/\s*\\mathsf\s*\{\s*s\s*\}\s*\/\s*\\mathsf\s*\{\s*c\s*m\s*\}\s*\^\s*\{\s*2\s*\}\s*\/\s*\\mathsf\s*\{\s*s\s*r\s*\}\s*\$\s*\)/gi,
    "(ph/s/cm²/sr)",
  );

  /** qPCR 引物方向 `${}^{5^{\prime}}$` / `${\mathfrak{3}}^{\prime}$` */
  s = s.replace(
    /\$\s*\{\s*\}\s*\^\s*\{\s*5\s*\^\s*\{\s*\\prime\s*\}\s*\}\s*\$/g,
    "5′",
  );
  s = s.replace(
    /\$\s*\{\s*\\mathfrak\s*\{\s*3\s*\}\s*\}\s*\^\s*\{\s*\\prime\s*\}\s*\$/gi,
    "3′",
  );

  /** `$2^{-\Delta \mathsf{Ct}}$` */
  s = s.replace(
    /\$\s*2\s*\^\s*\{\s*-\s*\\Delta\s*\\mathsf\s*\{\s*C\s*\}\s*\\mathsf\s*\{\s*t\s*\}\s*\}\s*\$/gi,
    "2^(-ΔCt)",
  );

  /** SPECT：`$55 \mathsf{kV}$`、`$140 \mathsf{keV}$`、`$48 \mathrm{~h~}$` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*k\s*V\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} kV` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*k\s*e\s*V\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} keV` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathrm\s*\{\s*~\s*h\s*~\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} h` : full;
    },
  );

  /** 流式：离心 `$300 ~ {\mathfrak{g}}$` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\{\s*\\mathfrak\s*\{\s*g\s*\}\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} g` : full;
    },
  );

  /** `$0.5 \ \mathsf{mM}$`（EDTA；`\ ` 为 LaTeX 空格） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*(?:\\\s+)?\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} mM` : full;
    },
  );

  /** `${\mathsf{Ca}}^{2+}$` / `$\mathsf{Mg}^{2+}$` */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*C\s*a\s*\}\s*\}\s*\^\s*\{\s*2\s*\+\s*\}\s*\$/gi,
    "Ca²⁺",
  );
  s = s.replace(
    /\$\s*\\mathsf\s*\{\s*M\s*g\s*\}\s*\^\s*\{\s*2\s*\+\s*\}\s*\$/gi,
    "Mg²⁺",
  );

  /** FACS：`Ca²⁺ and Mg²⁺ -free PBS).` 多余右括号 */
  s = s.replace(
    /Ca²⁺ and Mg²⁺ -free PBS\)\./g,
    "Ca²⁺- and Mg²⁺-free PBS.",
  );

  /** 磷酸化：`$20 \mathsf{mM}$`（无 `~`） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mM` : full;
    },
  );

  /** `$0.9 {\sf M}$` */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\{\s*\\sf\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} M` : full;
    },
  );

  /** `$\left( { \mathsf { p H } } < 6 \right.$ $,` → `(pH < 6,`（`\right.` 后另有闭合 `$`） */
  s = s.replace(
    /\$\s*\\left\s*\(\s*\{\s*\\mathsf\s*\{\s*p\s*H\s*\}\s*\}\s*<\s*6\s*\\right\s*\.\s*\$\s*,/gi,
    "(pH < 6,",
  );

  /** `2% ACN- $.0.1\%$ FA` */
  s = s.replace(
    /2%\s*ACN-\s*\$\s*\.\s*0\s*\.\s*1\s*\\?\s*%\s*\$\s*FA/gi,
    "2% ACN- 0.1% FA",
  );

  /** `$1.9 \ \mu \mathrm{m}$` 粒径（DIA 柱径） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*(?:\\\s+)?\s*\\mu\s*\\mathrm\s*\{\s*m\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} μm` : full;
    },
  );
  /** `$1.6 \mathsf{kV}$`（与 SPECT 的 kV 规则相同，允许 `1 . 6`） */
  s = s.replace(
    /\$\s*((?:[\d\s.])+)\s*\\mathsf\s*\{\s*k\s*V\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d*\.?\d+$/.test(n) ? `${n} kV` : full;
    },
  );
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mathrm\s*\{\s*m\s*\}\s*\/\s*z\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} m/z` : full;
    },
  );

  /** 修饰列表：`Gln- $\cdot >$ pyro-Glu` */
  s = s.replace(/Gln-\s*\$\s*\\cdot\s*>\s*\$\s*pyro-Glu/gi, "Gln→pyro-Glu");

  /** Perseus：`(version $1 . 6 . 15 . 0) ^ { 85 }$` */
  s = s.replace(
    /\(version\s+\$\s*1\s*\.\s*6\s*\.\s*1\s*5\s*\.\s*0\s*\)\s*\^\s*\{\s*8\s*5\s*\}\s*\$/gi,
    "(version 1.6.15.0)^85",
  );

  /** Metascape：`|1.5|, $_ {\mathsf{P} < 0.05)}$ ),` */
  s = s.replace(
    /\|\s*1\s*\.\s*5\s*\|\s*,\s*\$\s*_\s*\{\s*\\mathsf\s*\{\s*P\s*\}\s*<\s*0\s*\.\s*0\s*5\s*\)\s*\}\s*\$\s*\)\s*,/gi,
    "|1.5|, P < 0.05),",
  );

  /** FDR：`${\mathsf{p}}{<}0.05$` */
  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*p\s*\}\s*\}\s*\{\s*<\s*\}\s*0\s*\.\s*0\s*5\s*\$/gi,
    "p < 0.05",
  );

  /** `$50 ~ \mathsf { m M }$`（DTT 等；与 μM 的 `~\mu\mathsf{M}` 区分） */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*~\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      return /^\d+$/.test(n) ? `${n} mM` : full;
    },
  );

  return s;
}

export interface KbCleanupOptions extends CleanupOptions {
  collapseImageBlocks?: boolean;
  maxImagesPerRun?: number;
  /**
   * 去掉文首 `## 文档结构（MinerU JSON…）` 与 `- [pN] …` 清单（及紧随的 `---`），减少 RAG token、避免干扰主题检索。
   * 版面顺序仍可从同篇 MinerU JSON 恢复。
   */
  stripMineruStructureManifest?: boolean;
  /** 机构名、URL、括号等确定性 OCR 纠错（默认开启） */
  applyKbOcrTypoFixes?: boolean;
}

const DEFAULT_KB: KbCleanupOptions = {
  collapseImageBlocks: true,
  maxImagesPerRun: 1,
  stripMineruStructureManifest: true,
  applyKbOcrTypoFixes: true,
};

/**
 * 移除 {@link formatStructureSectionForKb} 写入的文首结构摘要块。
 */
export function stripMineruStructureManifest(text: string): string {
  return text.replace(
    /^##\s*文档结构（MinerU JSON，版面顺序）[\s\S]*?\n---\s*\n+/,
    "",
  );
}

/** 评审常见硬错误：机构名、URL 空格、重复右括号、PCR 退火温度缺少 °C */
export function normalizeKbOcrTypos(text: string): string {
  let s = text;
  s = s.replace(/\bPreybus\b/g, "Prebys");
  /** MinerU：DOI 链接中 `doi.org/ 10.` 误插入空格 */
  s = s.replace(/https:\/\/doi\.org\/\s+/gi, "https://doi.org/");
  s = s.replace(/(https?:\/\/zenodo)\.\s+(org[^\s)\]]*)/gi, "$1.$2");
  /** Elsevier 路径常见断行：`j. ccell` → `j.ccell` */
  s = s.replace(/(10\.1016\/j\.)\s+(ccell)/gi, "$1$2");
  s = s.replace(/\(\s*(\d+%[–-]\d+%)\s*\)\s*\)/g, "($1)");
  s = s.replace(
    /\bwith a (\d{2})C annealing temperature\b/gi,
    "with a $1°C annealing temperature",
  );
  /** `+` 非 \\w，勿在词尾用 \\b */
  s = s.replace(/\btota CD8\+/gi, "total CD8+");
  s = s.replace(/\bpathogenfree\b/gi, "pathogen-free");
  return s;
}

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
  const {
    collapseImageBlocks,
    maxImagesPerRun,
    stripMineruStructureManifest: stripManifest,
    applyKbOcrTypoFixes,
    ...cleanupOpts
  } = kb;

  let text = raw.replace(/\r\n/g, "\n");
  if (stripManifest !== false) {
    text = stripMineruStructureManifest(text);
  }
  text = dropMineruMarkdownNoise(text);
  text = joinLinesBrokenByRemovedPageNoise(text);
  text = flattenHtmlTablesToPlain(text);
  text = neutralizeCatalogHashesAndHexColors(text);
  text = normalizeMineruInlineLatex(text);
  text = cleanPdfTextMd(text, cleanupOpts);
  text = normalizeKbResidualDollarMath(text);
  if (applyKbOcrTypoFixes !== false) {
    text = normalizeKbOcrTypos(text);
  }

  if (collapseImageBlocks !== false) {
    text = collapseImageBlocksForKb(text, maxImagesPerRun ?? 1);
  }

  return text.trim() + "\n";
}
