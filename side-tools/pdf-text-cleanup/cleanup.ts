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
  /** 弱化常见 LaTeX/OCR 数学碎片（不保证可逆） */
  softenLatexArtifacts?: boolean;
}

const DEFAULT_OPTS: CleanupOptions = {
  keepFirstJournalTitle: true,
  mergeHyphenation: true,
  collapseBlankLines: true,
  normalizeTgfBetaMarkup: true,
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
  if (opts.softenLatexArtifacts) text = softenLatexArtifacts(text);
  if (opts.collapseBlankLines) text = collapseBlankLines(text);

  return text.trim() + "\n";
}
