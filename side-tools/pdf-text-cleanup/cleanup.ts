/**
 * PDF/Markdown 转文字后的启发式整理（与 bioagent 主线无关）。
 * 针对 Elsevier / Cell 系论文类导出常见噪声。
 */

export interface CleanupOptions {
  /** 保留文首「期刊名」行（如 Cancer Cell）仅第一次出现 */
  keepFirstJournalTitle?: boolean;
  /** 合并行末 `-` 导致的英文断词（如 recruit-\nment） */
  mergeHyphenation?: boolean;
  /** 将 3 段以上空行压成 2 段 */
  collapseBlankLines?: boolean;
  /**
   * 将 PDF 转写常见的 `$\tt T G F \{ \beta$` 等碎片还原为 **TGFβ** / **TGFβ1**（与排版一致）。
   * 仅匹配 T、G、F + beta 组合，不误伤 `CD31` 等其它 `\\tt` 公式。
   */
  normalizeTgfBetaMarkup?: boolean;
  /**
   * `$$ { \\tt C D 3 1 } ^ { + } $$`、`${ \\sf B } 2 2 0 ^ { + } $` 等免疫标记 OCR/LaTeX 碎片 → **CD31+**、**B220+** 等。
   */
  normalizeImmuneMarkerLatex?: boolean;
  /**
   * 样本量 `$$_ { \\it { n } } = 5$$`、µm²、浓度 `$1 5 \\mu { \\sf g } / \\sf m \\mu$`、误识 **CD20+**（`\\textcircled{1220}`）等杂项 OCR/LaTeX。
   */
  normalizeOcrLatexMisc?: boolean;
  /** 弱化常见 LaTeX/OCR 数学碎片（不保证可逆） */
  softenLatexArtifacts?: boolean;
}

const DEFAULT_OPTS: CleanupOptions = {
  keepFirstJournalTitle: true,
  mergeHyphenation: true,
  collapseBlankLines: true,
  normalizeTgfBetaMarkup: true,
  normalizeImmuneMarkerLatex: true,
  normalizeOcrLatexMisc: true,
  /** 默认关闭：公式块形态各异，自动替换易误伤正文（如 CD31 等） */
  softenLatexArtifacts: false,
};

/** 整行删除：页脚、版权、重复 DOI 等 */
function shouldDropLine(
  trimmed: string,
  ctx: { keptCancerCell: boolean; keptArticle: boolean },
  opts: CleanupOptions,
): "drop" | "keep" | "maybeJournal" {
  if (trimmed === "") return "keep";

  if (/^ll$/i.test(trimmed)) return "drop";
  if (/^Please cite this article in press as:/i.test(trimmed)) return "drop";
  if (/^Cancer Cell 44,/i.test(trimmed)) return "drop";
  if (/^All rights are reserved/i.test(trimmed)) return "drop";
  if (/Elsevier Inc\./i.test(trimmed) && /2026/i.test(trimmed)) return "drop";
  if (/^https:\/\/doi\.org\/10\.1016\/j\.ccell\.2026\.03\.004\s*$/i.test(trimmed))
    return "drop";
  if (/^Continued\s*$/i.test(trimmed)) return "drop";
  if (/^Graphical abstract\s*$/i.test(trimmed)) return "drop";

  /** 单独页码（正文中的编号多为「12. Author」） */
  if (/^\d{1,3}\s*$/.test(trimmed)) return "drop";
  if (/^e\d{1,3}\s*$/i.test(trimmed)) return "drop";

  if (opts.keepFirstJournalTitle && trimmed === "Cancer Cell") {
    if (!ctx.keptCancerCell) return "maybeJournal";
    return "drop";
  }
  if (opts.keepFirstJournalTitle && trimmed === "Article") {
    if (!ctx.keptArticle) return "maybeJournal";
    return "drop";
  }

  return "keep";
}

function applyLineFilters(text: string, opts: CleanupOptions): string {
  const lines = text.split(/\r?\n/);
  const ctx = { keptCancerCell: false, keptArticle: false };
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const decision = shouldDropLine(trimmed, ctx, opts);

    if (decision === "drop") continue;
    if (decision === "maybeJournal") {
      if (trimmed === "Cancer Cell") ctx.keptCancerCell = true;
      if (trimmed === "Article") ctx.keptArticle = true;
      out.push(line);
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

/** 英文单词在行尾被 `-` 拆开时合并（允许断行后多余空格，如 recruit-\n ment） */
function mergeHyphenation(text: string): string {
  return text.replace(/([a-zA-Z])-\s*\n\s*([a-z])/g, "$1$2");
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

/**
 * OCR 常把「TGFβ」排成 LaTeX 碎片；统一为与 PDF 一致的 Unicode：**TGFβ**、**TGFβ1** 等。
 */
function normalizeTgfBetaMarkup(text: string): string {
  let s = text;

  /**
   * `$\tt T G F \{ \mathrm { \beta } \}$`：末尾常为转义右花括号 `\}`（反斜杠 + `}`），非连续两个 `}`。
   */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\mathrm\s*\{\s*\\beta\s*\}\s*\\\}\s*\$/gi,
    "TGFβ",
  );

  /** 同上，缺末尾 `$` */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\mathrm\s*\{\s*\\beta\s*\}\s*\\\}/gi,
    "TGFβ",
  );

  /** `${ \sf T G F } \mathrm { \beta } \mathrm { . }$` 等变体 */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*T\s*G\s*F\s*\}\s*\\mathrm\s*\{\s*\\beta\s*\}\s*\\mathrm\s*\{\s*\.\s*\}/gi,
    "TGFβ",
  );

  /** `$$\tt T G F \{ \beta$$` 或未成对闭合的 `$$\tt T G F...` 单行块 */
  s = s.replace(
    /\$\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\beta\s*\$?\$?/gi,
    "TGFβ",
  );

  /** `$\tt T G F \{ \beta \uparrow` 等 OCR 混入符号 */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\beta\s*\\uparrow/gi,
    "TGFβ",
  );

  /** `$\tt T G F \beta 1$` → TGFβ1；`$\tt T G F \beta$` → TGFβ */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\beta\s*(\d*)\s*\$/gi,
    (_, digits: string) => "TGFβ" + digits,
  );

  /**
   * `$\tt T G F \{ \beta$` 缺闭合、或后接空格/标点（含不完整 `$`）
   * 注意：先处理带 `\{` 的，且要求 T、G、F 连续，避免匹配 CD31。
   */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\beta\s*\$?/gi,
    "TGFβ",
  );

  /** 行尾仍残留的 `silences this ... $$\tt T G F \{ \beta` 无第二个 $ */
  s = s.replace(
    /\$\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\beta/gi,
    "TGFβ",
  );

  /** 多步替换后残留的 `$TGFβ$` / `$TGFβ1$`（与正文排版一致，去掉美元符） */
  s = s.replace(/\$TGFβ(\d+)\$/g, "TGFβ$1");
  s = s.replace(/\$TGFβ\$/g, "TGFβ");

  /** `TGF $$\mathrm { \Delta \ddot { \beta } }$$` 等变体 → TGFβ */
  s = s.replace(
    /TGF\s*\$\$\s*\\mathrm\s*\{\s*\\Delta\s*\\ddot\s*\{\s*\\beta\s*\}\s*\}\s*\$\$/gi,
    "TGFβ",
  );

  /** `$${ \tt T G F \beta }$$` / `$$ { \tt T G F \beta } $$`（无 `\{`，β 在 `\tt` 块内） */
  s = s.replace(
    /\$\$\s*\{\s*\\tt\s*T\s*G\s*F\s*\\beta\s*\}\s*\$\$/gi,
    "TGFβ",
  );

  /** `TG $$\mathrm { \ddot { \beta } }$$`（β 被排成 umlaut+β）→ **TGFβ** */
  s = s.replace(
    /TG\s*\$\$\s*\\mathrm\s*\{\s*\\ddot\s*\{\s*\\beta\s*\}\s*\}\s*\$\$/gi,
    "TGFβ",
  );

  /** `${ \sf T G F } \mathrm { \beta } \mathrm { . }$` */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*T\s*G\s*F\s*\}\s*\\mathrm\s*\{\s*\\beta\s*\}\s*\\mathrm\s*\{\s*\.\s*\}\s*\$/gi,
    "TGFβ",
  );

  /** `$\tt T G F \{ \mathrm { \beta } \}$`（如参考文献 TGFβR1 inhibitor） */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\mathrm\s*\{\s*\\beta\s*\}\s*\}\s*\$/gi,
    "TGFβ",
  );

  /** `$\tt T G F \{ \beta \uparrow` 等未闭合块 */
  s = s.replace(
    /\$\s*\\tt\s*T\s*G\s*F\s*\\\{\s*\\beta\s*\\uparrow/gi,
    "TGFβ",
  );

  return s;
}

/** 去掉 OCR 在字母/数字间插入的空格 */
function collapseSpacedChars(fragment: string): string {
  return fragment.replace(/\s+/g, "");
}

/**
 * 判断折叠后是否为常见 **CD** 系标记（CD8、CD31、CD45 等），避免误替换非 CD 的 `\\tt` 内容。
 */
function isCdLikeToken(collapsed: string): boolean {
  /** CD8、CD31、CD11b 等 */
  return (
    /^CD[0-9]+[a-z]?$/i.test(collapsed) &&
    collapsed.length >= 3 &&
    collapsed.length <= 10
  );
}

/**
 * `$$ { \\tt C D 3 1 } ^ { + } $$`、`${ \\sf B } 2 2 0 ^ { + } $`、`${ \\sf T } _ { \\sf H } { \\sf 1 } $` 等 → **CD31+**、**B220+**、**TH1**。
 */
function normalizeImmuneMarkerLatex(text: string): string {
  let s = text;

  const supToSuffix = (sup: string): string => {
    if (sup === "+" || sup === "＋") return "+";
    if (sup === "-" || sup === "−" || sup === "–") return "−";
    return "+" + sup;
  };

  /**
   * `${ \tt C D 8 ^ { + } }$`：上标在 `\tt` 花括号**内部**（与 `} ^ { + }` 在括号外不同）。
   */
  s = s.replace(
    /\$\s*\{\s*\\tt\s*((?:[A-Za-z0-9]\s*)+)\s*\^\s*\{\s*([+\-−–])\s*\}\s*\}\s*\$/g,
    (full, body: string, sup: string) => {
      const token = collapseSpacedChars(body);
      if (!isCdLikeToken(token)) return full;
      return token + supToSuffix(sup);
    },
  );

  s = s.replace(
    /\$\$\s*\{\s*\\tt\s*((?:[A-Za-z0-9]\s*)+)\s*\^\s*\{\s*([+\-−–])\s*\}\s*\}\s*\$\$/g,
    (full, body: string, sup: string) => {
      const token = collapseSpacedChars(body);
      if (!isCdLikeToken(token)) return full;
      return token + supToSuffix(sup);
    },
  );

  /** `${ \tt C D 8 + }$`（加号无 `^`，与数字间可有空格） */
  s = s.replace(
    /\$\s*\{\s*\\tt\s*((?:[A-Za-z0-9]\s*)+)\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const token = collapseSpacedChars(body);
      if (!isCdLikeToken(token)) return full;
      return token + "+";
    },
  );

  /** `$$ { \tt C D … } ^ { +/- } $$` */
  s = s.replace(
    /\$\$\s*\{\s*\\tt\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*([+\-−–])\s*\}\s*\$\$/g,
    (full, body: string, sup: string) => {
      const token = collapseSpacedChars(body);
      if (!isCdLikeToken(token)) return full;
      return token + supToSuffix(sup);
    },
  );

  /** `$\{ \tt C D … \} ^ { +/- } $`（单美元块） */
  s = s.replace(
    /\$\s*\{\s*\\tt\s*((?:[A-Za-z0-9]\s*)+)\}\s*\^\s*\{\s*([+\-−–])\s*\}\s*\$/g,
    (full, body: string, sup: string) => {
      const token = collapseSpacedChars(body);
      if (!isCdLikeToken(token)) return full;
      return token + supToSuffix(sup);
    },
  );

  /** `${ \sf B } 2 2 0 ^ { + }$` → B220+（B 细胞标记；数字在 `\\sf` 外） */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*([A-Za-z])\s*\}\s*((?:\d\s*)+)\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (_, letter: string, digits: string) =>
      letter + collapseSpacedChars(digits) + "+",
  );

  /** `${ \sf T } _ { \sf H } { \sf 1 }$` → TH1 */
  s = s.replace(
    /\$\s*\{\s*\\sf\s*T\s*\}\s*_\s*\{\s*\\sf\s*[Hh]\s*\}\s*\{\s*\\sf\s*1\s*\}\s*\$/g,
    "TH1",
  );

  return s;
}

/**
 * 样本量、单位、误识标记等零散 LaTeX/OCR 碎片（与免疫/TGF 分函数互补）。
 */
function normalizeOcrLatexMisc(text: string): string {
  let s = text;

  /** `$$_ { \it { n } } } = 5$$`（多一个 `}`）或 `$$_ { \it { n } } = 5$$` */
  s = s.replace(
    /\$\$\s*_\s*\{\s*\\it\s*\{\s*n\s*\}\s*\}\s*\}\s*=\s*(\d+)\s*\$\$/gi,
    " (n = $1) ",
  );
  s = s.replace(
    /\$\$\s*_\s*\{\s*\\it\s*\{\s*n\s*\}\s*\}\s*=\s*(\d+)\s*\$\$/gi,
    " (n = $1) ",
  );

  /** OCR 将 CD20 误为 circled「1220」 */
  s = s.replace(
    /\$\s*\\textcircled\s*\{\s*1\s*2\s*2\s*0\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    "CD20+",
  );

  /** `μm(2)` / `μm(2))` → µm² */
  s = s.replace(/μm\s*\(\s*2\s*\)\s*\)/g, "µm²)");
  s = s.replace(/μm\s*\(\s*2\s*\)/g, "µm²");
  s = s.replace(/\\mu\s*m\s*\(\s*2\s*\)/gi, "µm²");

  /** 千位逗号内多余空格 `10, 000` → `10,000` */
  s = s.replace(/(\d{1,3}),\s+(\d{3})\b/g, "$1,$2");

  /** `$1 5 \mu { \sf g } / \sf m \mu$` → `15 μg/ml` */
  s = s.replace(
    /\$\s*((?:\d\s*)+)\s*\\mu\s*\{\s*\\sf\s*g\s*\}\s*\/\s*\\sf\s*m\s*\\mu\s*\$/gi,
    (_, rawNum: string) => {
      const n = collapseSpacedChars(rawNum).replace(/\D/g, "");
      return n ? `${n} μg/ml` : _;
    },
  );

  /** `250μ g/mμ` 类浓度 */
  s = s.replace(
    /(\d+)\s*μ\s*g\s*\/\s*mμ/g,
    (_, n: string) => `${n} μg/ml`,
  );

  /** `15 μ g/mL` → `15 μg/mL` */
  s = s.replace(/(\d+)\s*μ\s+g\//gi, "$1 μg/");

  /** `$$ { \sf H } _ { 2 } 0 _ { 2 } $$`（O 常为数字 0） */
  s = s.replace(
    /\$\$\s*\{\s*\\sf\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*[0O]\s*_\s*\{\s*2\s*\}\s*\$\$/gi,
    "H₂O₂",
  );

  /** KPC 基因型常见 OCR：`$\underline{{K}} Ras^{G12D}/\underline{{p}}53^{...}$` */
  s = s.replace(
    /\$\s*\\underline\s*\{\s*\{\s*K\s*\}\s*\}\s*R\s*a\s*s\s*\^\s*\{\s*G\s*1\s*2\s*D\s*\}\s*\/\s*\\underline\s*\{\s*\{\s*p\s*\}\s*\}\s*5\s*3\s*\^\s*\{\s*R\s*1\s*7\s*2\s*H\s*\/\s*w\s*t\s*\}\s*\)\s*\$/gi,
    "KRas^G12D/p53^R172H/wt)",
  );

  /** 前几步后仍残留的孤立 `$` */
  s = s.replace(/TGFβ\$/g, "TGFβ");

  /** `$${ \tt 6 0 ^ { \circ } C }$$` 等 → `60°C`（`^ { \circ }` 与 `C` 之间无额外 `}`） */
  s = s.replace(
    /\$\$\s*\{\s*\\tt\s*((?:\d\s*)+)\s*\^\s*\{\s*\\circ\s*\}\s*C\s*\}\s*\$\$/gi,
    (full, raw: string) => {
      const n = collapseSpacedChars(raw);
      if (!/^\d{1,3}$/.test(n)) return full;
      return `${n}°C`;
    },
  );

  /** OCR：`doH(2)0` → dH₂O（去离子水类洗涤液） */
  s = s.replace(/\bdoH\s*\(\s*2\s*\)\s*0\b/gi, "dH₂O");

  return s;
}

/**
 * 可选：仅处理极窄、低误伤模式；复杂公式请人工或专业 LaTeX 工具。
 * 默认不启用（见 DEFAULT_OPTS）。
 */
function softenLatexArtifacts(text: string): string {
  let s = text;
  s = s.replace(
    /\$(?!\\?\$)\s*\\tt\s*T\s*G\s*F\s*\\\{?\s*\\beta\s*\}?/gi,
    "TGFβ",
  );
  return s;
}

export function cleanPdfTextMd(
  raw: string,
  options: CleanupOptions = {},
): string {
  const opts = { ...DEFAULT_OPTS, ...options };
  let text = raw.replace(/\r\n/g, "\n");

  text = applyLineFilters(text, opts);

  if (opts.mergeHyphenation) text = mergeHyphenation(text);
  if (opts.normalizeTgfBetaMarkup !== false) text = normalizeTgfBetaMarkup(text);
  if (opts.normalizeImmuneMarkerLatex !== false) {
    text = normalizeImmuneMarkerLatex(text);
  }
  if (opts.normalizeOcrLatexMisc !== false) text = normalizeOcrLatexMisc(text);
  if (opts.softenLatexArtifacts) text = softenLatexArtifacts(text);
  if (opts.collapseBlankLines) text = collapseBlankLines(text);

  return text.trim() + "\n";
}
