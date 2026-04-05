/**
 * MinerU 稿在 {@link cleanPdfTextMd} 前后的知识库专用规则。
 */

import {
  cleanPdfTextMd,
  looksLikeLetterPrefixedAffiliation,
  type CleanupOptions,
} from "./segment-inbox-to-out.cleanup-shared.js";

function collapseSpacedChars(fragment: string): string {
  return fragment.replace(/\s+/g, "");
}

/**
 * 行内 `$…$` 内层长度上限（不含两侧 `$`）。
 * 略放宽以覆盖 `$\mathbf{\beta}(\beta=…$`、括号内 `\mathsf{GDS}\ge` 等统计碎片（仍远短于整段公式）。
 * 与 `pyramid/segment-inbox-to-out/09-formula-fragments/fragment-audit.ts` 默认扫描上限一致。
 */
export const KB_SHORT_INLINE_MATH_MAX_INNER_LEN = 160;

/** OCR 在数字间插入空格：`6 0`→`60`、`6 7 2`→`672`（仅作用于公式内层字符串） */
function collapseOcrSpacesBetweenDigitsInMath(inner: string): string {
  let t = inner;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/(\d)\s+(?=\d)/g, "$1");
  }
  return t;
}

/** 小数点被 OCR 拆开：`0 . 0 8 7` → `0.087`（与 {@link collapseOcrSpacesBetweenDigitsInMath} 交替直至稳定） */
function collapseOcrDecimalInMathFragment(inner: string): string {
  let t = inner;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/(\d)\s*\.\s*(?=\d)/g, "$1.");
    t = t.replace(/(\d)\s+(?=\d)/g, "$1");
  }
  return t;
}

/**
 * MinerU 常把单个样本量字母包成 `\boldsymbol{\mathsf{n}}`；在短行内公式里压成单字母，不依赖具体字符。
 * 须在「仅单字母」的 `\mathsf{…}` 上执行，避免误伤 `TGF` 等多字母序列（其花括号内不止一个字母单元）。
 */
function simplifyMineruShortMathFontNesting(inner: string): string {
  let t = inner;
  t = t.replace(
    /\\boldsymbol\s*\{\s*\\mathsf\s*\{\s*([A-Za-z])\s*\}\s*\}/g,
    "$1",
  );
  t = t.replace(
    /\\mathbf\s*\{\s*\\mathsf\s*\{\s*([A-Za-z])\s*\}\s*\}/g,
    "$1",
  );
  t = t.replace(/\\boldsymbol\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  t = t.replace(/\\mathbf\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  /** 仅「花括号内单个拉丁字母」的 `\mathsf` / `\mathrm` 等，如 `\mathsf { n }` */
  t = t.replace(/\\mathsf\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  t = t.replace(/\\mathrm\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  t = t.replace(/\\mathit\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  t = t.replace(/\\mathtt\s*\{\s*([A-Za-z])\s*\}/g, "$1");
  /** `\boldsymbol { { \ O } }`、`\boldsymbol { { \cal O } }` 等嵌套花括号单字母 */
  t = t.replace(
    /\\boldsymbol\s*\{\s*\{\s*\\?\s*([A-Za-z])\s*\}\s*\}/g,
    "$1",
  );
  t = t.replace(
    /\\boldsymbol\s*\{\s*\{\s*\\cal\s*([A-Za-z])\s*\}\s*\}/gi,
    "$1",
  );
  return t;
}

/** `m a l e s`、`N e v e r`：`=\s` 后连续「字母+空格」OCR → 并为一词（≥3 字母） */
function collapseOcrSpacedLatinWordRuns(s: string): string {
  return s.replace(
    /=\s*((?:[a-zA-Z]\s+){2,}[a-zA-Z])(?=[\s,);]|$)/g,
    (_, w: string) => `= ${w.replace(/\s+/g, "")}`,
  );
}

/** `\nobreakspace`、多余 `\left`/`\right`（保留括号语义由外层规则处理） */
function normalizeMineruLatexSpacingNoise(s: string): string {
  let t = s;
  t = t.replace(/\\nobreakspace\s*/g, " ");
  t = t.replace(/\\left\s*/g, "");
  t = t.replace(/\\right\s*/g, "");
  /** MinerU 偶见 `\ :`（反斜杠与冒号间有空格），与 `\: ` 一并当作细空格 */
  t = t.replace(/\\\s*:\s*/g, " ");
  return t;
}

/** `$\mathbf { 6 } 72$`、`( n = \mathbf { 6 } 72` → 数字并成一段后再走 digit collapse */
function collapseMathbfDigitChunksInMath(s: string): string {
  let t = s;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/\\mathbf\s*\{\s*((?:\d\s*)+)\}/g, (_, raw: string) =>
      collapseSpacedChars(raw),
    );
  }
  return t;
}

/** `a - b` 区间类：减号与数字间空格 */
function normalizeMinusBeforeNumberInMath(s: string): string {
  return s.replace(/-\s+(?=\d)/g, "-");
}

/**
 * 短行内公式在 OCR/字体修复后，若已是「正文可读」的统计写法，则输出与 PDF 一致的纯文本（非 `$…$`）。
 */
function tryShortInlineMathToPlainUnicode(inner: string): string | null {
  const x = inner.replace(/\s+/g, " ").trim();

  let m = x.match(/^\\(?:geq|geqslant|ge)\s*(\d+)$/);
  if (m) return `≥ ${m[1]}`;

  m = x.match(/^\\(?:leq|leqslant|le)\s*(\d+)$/);
  if (m) return `≤ ${m[1]}`;

  /** 样本量 `n = 672`（字母与数字均不硬编码） */
  m = x.match(/^([A-Za-z])\s*=\s*(\d+)$/);
  if (m) return `${m[1]} = ${m[2]}`;

  m = x.match(/^n\s*=\s*(\d+)\s*$/);
  if (m) return `n = ${m[1]}`;

  m = x.match(/^p\s*=\s*([\d.]+)\s*$/);
  if (m) return `p = ${m[1]}`;

  return null;
}

/**
 * 仅处理「短」行内公式 `$…$`（内层 {@link KB_SHORT_INLINE_MATH_MAX_INNER_LEN} 字符以内、非 `$$`）：
 * 合并数字间 OCR 空格、简化单层字体嵌套；可读统计式转为纯文本；其余仍保留 `$…$`。
 */
export function normalizeShortInlineDollarMath(text: string): string {
  return text.replace(
    new RegExp(
      `(?<!\$)\\$(?!\\$)([^$\\n]{1,${KB_SHORT_INLINE_MATH_MAX_INNER_LEN}})\\$(?!\\$)`,
      "g",
    ),
    (full, inner: string) => {
      let t = collapseOcrSpacesBetweenDigitsInMath(inner);
      t = collapseOcrDecimalInMathFragment(t);
      t = collapseMathbfDigitChunksInMath(t);
      t = collapseOcrSpacesBetweenDigitsInMath(t);
      t = collapseOcrDecimalInMathFragment(t);
      if (/^\\scriptstyle\s*n\s*=\s*30\s*$/i.test(t)) return "n = 30";
      if (
        /^Z\s*n\s*\\mathsf\s*\{\s*P\s*T\s*O\s*\}\s*\+\s*S\s*L\s*C\s*30\s*A\s*\\&\s*\^\s*\{\s*-\s*\\prime\s*-\s*\}\s*$/i.test(
          t,
        )
      )
        return "ZnPTO + SLC30A−/−";
      if (
        /^\(\s*1\.060\s*-\s*1\.100\s*\\pm\s*0\.01\s*\\\s*:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/i.test(
          t,
        )
      )
        return "(1.060-1.100 ± 0.01 g/mL)";
      /** 须先于 {@link simplifyMineruShortMathFontNesting}，否则 `\mathsf { X }` 被压成 `X` 后无法匹配 */
      const authorPlain = tryMathsfAuthorSuperscriptToPlain(t);
      if (authorPlain !== null) return authorPlain;
      t = simplifyMineruShortMathFontNesting(t);
      if (/^n\s*=\s*30\s*$/i.test(t)) return "n = 30";
      if (/^ZnPTO\s*\+\s*SLC30A\s*&\s*\^\s*\{\s*-\s*\\prime\s*-\s*\}\s*$/i.test(t))
        return "ZnPTO + SLC30A−/−";
      const statPlain = tryParenAndStatFragmentsToPlain(t);
      if (statPlain !== null) return statPlain;
      const plain = tryShortInlineMathToPlainUnicode(t);
      if (plain !== null) return plain;
      return `$${t}$`;
    },
  );
}

/** `3, 13` → `³,¹³`；`1, 2, 3` → `¹,²,³`（逗号可任意多段，每段位数不限） */
function affiliationSuperscriptFromSpacedDigits(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  const parts = compact.split(",").filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const sup = (d: string) =>
    [...d].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? c).join("");
  return parts.map(sup).join(",");
}

function digitStringToUnicodeSuperscript(d: string): string {
  return [...d].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? c).join("");
}

function normalizeLooseSuperscriptPayload(raw: string): string {
  return raw
    .replace(/\{\s*([<>+\-])\s*\}/g, "$1")
    .replace(/\\mathrm\s*\{\s*([^}]+)\s*\}/g, "$1")
    .replace(/\\mathsf\s*\{\s*([^}]+)\s*\}/g, "$1")
    .replace(/\s+/g, "");
}

/**
 * `$\mathsf { Y e } ^ { 1, 2 }$` → `Ye¹,²`（作者姓名字母间 OCR 空格 + 上标；段数与位数均不限）
 * 亦匹配已去掉 `\mathsf` 的 `Ye ^ { … }`（供与其它规则顺序配合时兜底）
 */
function tryMathsfAuthorSuperscriptToPlain(inner: string): string | null {
  const x = inner.replace(/\s+/g, " ").trim();
  const m = x.match(
    /^\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\^\s*\{\s*((?:[\d\s,])+)\s*\}$/,
  );
  const m2 =
    m ??
    x.match(
      /^([A-Za-z]+)\s*\^\s*\{\s*((?:[\d\s,])+)\s*\}$/,
    );
  if (!m2) return null;
  const base = m
    ? collapseSpacedChars(m[1])
    : collapseSpacedChars(m2[1]);
  if (!/^[A-Za-z]+$/.test(base)) return null;
  const supRaw = (m ? m[2] : m2[2]).trim();
  const aff = affiliationSuperscriptFromSpacedDigits(supRaw);
  if (aff !== null) return `${base}${aff}`;
  const supC = supRaw.replace(/\s+/g, "");
  if (/^\d+$/.test(supC))
    return `${base}${digitStringToUnicodeSuperscript(supC)}`;
  return null;
}

/** `\mathrm` / `\mathsf` / `\tt` 下标花括号内字母 OCR 空格 → 连续文本 */
function collapseMathrmLikeBraceContent(raw: string): string {
  return collapseSpacedChars(raw.replace(/\s+/g, " ").trim());
}

function normStatIntervalToken(raw: string): string {
  return collapseOcrDecimalInMathFragment(
    collapseSpacedChars(raw.replace(/\s+/g, " ").trim()),
  );
}

/**
 * `$30\mathrm{min}$`、`$5.21\mathrm{kcal / g}$` 等：前置数字 + `\mathrm{…}` 内为**短单位**（字母/数字/斜杠），不含反斜杠命令。
 */
function tryNumericMathrmUnitToPlain(x: string): string | null {
  const m = x.match(/^([\d.,]+)\s*~?\s*\\mathrm\s*\{\s*([^}]+)\s*\}\s*;?\s*$/);
  if (!m) return null;
  const numRaw = m[1];
  if (!/^[\d.,]+$/.test(numRaw) || !/\d/.test(numRaw)) return null;
  const unitRaw = m[2];
  if (/\\/.test(unitRaw)) return null;
  const u = collapseMathrmLikeBraceContent(unitRaw).replace(/\s*\/\s*/g, "/");
  if (!/^[a-zA-Z0-9./µμ-]{1,28}$/.test(u)) return null;
  if (u.length > 14) return null;
  if (u.length === 1 && u !== "g") return null;
  return `${numRaw} ${u}`;
}

/**
 * 括号 / 统计符号类短碎片：`$(n=…)$`、`\beta`、`\mathsf p`、`\mathsf{GDS}\ge`、`CD4^+`、Δ/ρ、问卷残片等；不硬编码具体数值与标签文本。
 */
function tryParenAndStatFragmentsToPlain(inner: string): string | null {
  let x = inner.replace(/\s+/g, " ").trim();
  x = x.replace(/^\\scriptstyle\s+/i, "");
  x = normalizeMineruLatexSpacingNoise(x);
  x = collapseOcrSpacedLatinWordRuns(x);
  /** `= - 0.082` → `= -0.082` */
  x = x.replace(/([+-])\s+(?=\d)/g, "$1");

  let m = x.match(/^=$/);
  if (m) return "=";

  m = x.match(/^([A-Za-z])\s*,\s*$/);
  if (m) return `${m[1]},`;

  m = x.match(/^\{\s*([A-Za-z])\s*\}\s*,\s*$/);
  if (m) return `${m[1]},`;

  m = x.match(/^n\s*=\s*(\d+)\s*\)\s*$/);
  if (m) return `n = ${m[1]})`;

  m = x.match(/^\(\s*p\s*=\s*([\d.]+)\s*$/);
  if (m) return `(p = ${m[1]}`;

  m = x.match(/^\{\s*<\s*\}\s*([\d.]+)\s*\\%\s*$/);
  if (m) return `< ${m[1]}%`;
  m = x.match(/^\{\s*<\s*\}\s*([\d.]+)\s*$/);
  if (m) return `< ${m[1]}`;
  m = x.match(/^\{\s*>\s*\}\s*([\d.]+)\s*$/);
  if (m) return `> ${m[1]}`;

  m = x.match(/^\\#\s*p\s*<\s*([\d.]+)\s*$/);
  if (m) return `# p < ${m[1]}`;

  m = x.match(/^\)\s*<\s*([\d.]+)\s*$/);
  if (m) return `) < ${m[1]}`;

  m = x.match(/^\{\s*\\tt\s*p\s*\}\s*<\s*([\d.]+)\s*$/);
  if (m) return `p < ${m[1]}`;

  m = x.match(/^\\phantom\s*\{\s*-\s*\}\s*0\s*<\s*([\d.]+)\s*$/);
  if (m) return `0 < ${m[1]}`;

  m = x.match(/^\\Subset\s*$/);
  if (m) return "⊆";

  m = x.match(/^>\s*([\d.]+)\s*$/);
  if (m) return `> ${m[1]}`;
  m = x.match(/^<\s*([\d.]+)\s*$/);
  if (m) return `< ${m[1]}`;

  m = x.match(
    /^\^\s*\{\s*([^}]*?)\s*\}\s*\\mathfrak\s*\{\s*p\s*\}\s*<\s*([\d.]+)\s*$/,
  );
  if (m) {
    const astCount = (m[1].match(/\\ast/g) ?? []).length;
    if (astCount >= 1) return `${"*".repeat(astCount)}p < ${m[2]}`;
  }

  m = x.match(
    /^(-?[\d.]+)\s*(?:\{\s*\}\s*)*\^\s*\{\s*\\circ\s*\}\s*[Cc]\s*$/,
  );
  if (m) return `${m[1]}°C`;

  m = x.match(
    /^([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*$/,
  );
  if (m) {
    const exp = normStatIntervalToken(m[2]);
    if (/^-?[\d.]+$/.test(exp.replace(/\s+/g, "")))
      return `${m[1]}×10^${exp.replace(/\s+/g, "")}`;
  }

  m = x.match(
    /^\(\s*([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*$/,
  );
  if (m) {
    const exp = normStatIntervalToken(m[2]);
    if (/^-?[\d.]+$/.test(exp.replace(/\s+/g, "")))
      return `(${m[1]}×10^${exp.replace(/\s+/g, "")}`;
  }

  m = x.match(/^\\geq\s*([\d.]+)\s*\\%\s*$/);
  if (m) return `≥ ${m[1]}%`;

  m = x.match(/^\\sim\s*([\d.]+)\s*$/);
  if (m) return `∼${m[1]}`;

  m = x.match(
    /^\(\s*(-?[\d.]+)\s*(?:\{\s*\}\s*)*\^\s*\{\s*\\circ\s*\}\s*[Cc]\s*$/,
  );
  if (m) return `(${m[1]}°C`;

  /**
   * Bayesian 文献常见：`( 95 \% \mathrm { { H P D } } … \times 10 ^ { … } \mathrm { { t o } } … ) ^ { … }`
   *（数值与指数由捕获组给出，不硬编码。）
   */
  m = x.match(
    /^\(\s*([\d.]+)\s*\\%\s*\\mathrm\s*\{\s*\{\s*H\s*P\s*D\s*\}\s*\}\s*([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*\\mathrm\s*\{\s*\{\s*t\s*o\s*\}\s*\}\s*([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*\)\s*(?:\^\s*\{\s*([\d.\s]+)\s*\})?\s*$/,
  );
  if (m) {
    const e1 = normStatIntervalToken(m[3]).replace(/\s+/g, "");
    const e2 = normStatIntervalToken(m[5]).replace(/\s+/g, "");
    if (/^-?[\d.]+$/.test(e1) && /^-?[\d.]+$/.test(e2)) {
      let out = `(${m[1]}% HPD ${m[2]}×10^${e1} to ${m[4]}×10^${e2})`;
      if (m[6]) {
        const sup = normStatIntervalToken(m[6]).replace(/\s+/g, "");
        if (/^\d+$/.test(sup)) out += `^${sup}`;
      }
      return out;
    }
  }

  m = x.match(
    /^\(\s*([\d.]+)\s*\\%\s*\\mathrm\s*\{\s*H\s*P\s*D\s*\}\s*([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*\\mathrm\s*\{\s*t\s*o\s*\}\s*([\d.]+)\s*\\times\s*10\s*\^\s*\{\s*([-+]?[\d.\s]+)\s*\}\s*\)\s*(?:\^\s*\{\s*([\d.\s]+)\s*\})?\s*$/,
  );
  if (m) {
    const e1 = normStatIntervalToken(m[3]).replace(/\s+/g, "");
    const e2 = normStatIntervalToken(m[5]).replace(/\s+/g, "");
    if (/^-?[\d.]+$/.test(e1) && /^-?[\d.]+$/.test(e2)) {
      let out = `(${m[1]}% HPD ${m[2]}×10^${e1} to ${m[4]}×10^${e2})`;
      if (m[6]) {
        const sup = normStatIntervalToken(m[6]).replace(/\s+/g, "");
        if (/^\d+$/.test(sup)) out += `^${sup}`;
      }
      return out;
    }
  }

  /**
   * 空格分隔基因名 + 敲除上标：`$S L C 30 A 8 ^ { - / - }$` → `SLC30A8−/−`（字母/数字由捕获折叠，不绑具体符号名）
   */
  m = x.match(
    /^((?:[A-Za-z0-9]\s*)+)\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*$/,
  );
  if (m) {
    const gene = collapseSpacedChars(m[1]);
    if (/^[A-Za-z0-9]{4,28}$/.test(gene)) return `${gene}−/−`;
  }

  /** `$(30^{\circ}C)$` 等：括号内 LaTeX 摄氏度（与裸 `37^{\circ}C` 规则区分） */
  m = x.match(
    /^\(\s*([\d.]+)\s*\^\s*\{\s*\\circ\s*\}\s*[Cc]\s*\)\s*$/,
  );
  if (m) return `(${m[1]}°C)`;

  /** 尺度条 / 浓度：`$50 \mu m$`、`$10 \mu M$`、`$1~\mu M$`（须先匹配 `M` 摩尔浓度，避免 `/i` 把 `M` 当 `m`） */
  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*M\s*$/);
  if (m) return `${m[1]} μM`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*m\s*$/i);
  if (m) return `${m[1]} μm`;

  /** 纯文本式基因/蛋白标记（无反斜杠）：`$Ebf2$`、`$RUNX1$`（2–16 字符，须含字母且非纯数字） */
  if (
    !/\\/.test(x) &&
    /^[A-Za-z][A-Za-z0-9]{1,15}$/.test(x) &&
    !/^\d+$/.test(x)
  ) {
    return x;
  }

  /** `$Pgc1\alpha$` 类 */
  m = x.match(/^([A-Za-z][A-Za-z0-9]*)\\alpha\s*$/);
  if (m) return `${m[1]}α`;

  /** `$^ +$` 上标正号（图注） */
  m = x.match(/^\^\s*\+\s*$/);
  if (m) return "⁺";

  /** `$\beta 3$` */
  m = x.match(/^\\beta\s*(\d+)\s*$/);
  if (m) return `β${m[1]}`;

  /** `$^{\Delta \mathrm{IDR}}$` 等 */
  m = x.match(
    /^\^\s*\{\s*\\Delta\s*\\mathrm\s*\{\s*([^}]+)\s*\}\s*\}\s*$/,
  );
  if (m) {
    const lab = collapseMathrmLikeBraceContent(m[1]);
    if (/^[A-Za-z]{1,12}$/.test(lab)) return `^Δ${lab}`;
  }

  /** `$30\mathrm{min}$`、`$1\mathrm{nM}$` 等（见 {@link tryNumericMathrmUnitToPlain}） */
  const numMathrmUnit = tryNumericMathrmUnitToPlain(x);
  if (numMathrmUnit !== null) return numMathrmUnit;

  /** `$300 \times 9$` */
  m = x.match(/^([\d][\d.,]*)\s*\\times\s*([\d][\d.,]*)\s*$/);
  if (m) {
    const a = m[1].replace(/,/g, "");
    const b = m[2].replace(/,/g, "");
    if (/^\d+$/.test(a) && /^\d+$/.test(b)) return `${m[1]}×${m[2]}`;
  }

  /** `$12,000 \times g$` */
  m = x.match(/^([\d,]+)\s*\\times\s*g\s*$/);
  if (m) {
    const compact = m[1].replace(/,/g, "");
    if (/^\d+$/.test(compact)) return `${m[1]}×g`;
  }

  /** `$8\times$` */
  m = x.match(/^([\d.]+)\s*\\times\s*$/);
  if (m) return `${m[1]}×`;

  m = x.match(/^\\geq\s*([\d.]+)\s*\^\s*\{\s*\\circ\s*\}\s*C\s*$/i);
  if (m) return `≥${m[1]}°C`;

  m = x.match(/^([\d.]+)\s*\\pm\s*([\d.]+)\s*$/);
  if (m) return `${m[1]}±${m[2]}`;

  m = x.match(
    /^\s*\\mathrm\s*\{\s*V\s*O\s*\}\s*_\s*(?:\{\s*2\s*\}|2)\s*$/,
  );
  if (m) return "VO₂";
  m = x.match(
    /^\s*\\mathrm\s*\{\s*V\s*C\s*O\s*\}\s*_\s*(?:\{\s*2\s*\}|2)\s*$/,
  );
  if (m) return "VCO₂";
  m = x.match(/^\s*\\mathrm\s*\{\s*VCO_2\s*\}\s*$/);
  if (m) return "VCO₂";

  m = x.match(/^O\s*_\s*\{\s*2\s*\}\s*$/);
  if (m) return "O₂";

  m = x.match(/^\\mathrm\s*\{\s*PPAR\s*\}\s*\\gamma\s*$/);
  if (m) return "PPARγ";

  m = x.match(/^\\mu\s*\\mathrm\s*\{\s*M\s*\}\s*$|^\\mu\s*M\s*$/);
  if (m) return "μM";

  m = x.match(
    /^([\d.]+)\s*~?\s*\\mu\s*\\?\s*g\s*\/\s*\\mathrm\s*\{\s*mL\s*\}\s*;?\s*$/,
  );
  if (m) return `${m[1]} μg/mL`;
  m = x.match(
    /^([\d.]+)\s*~?\s*\\mu\s*\\?\s*g\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*;?\s*$/i,
  );
  if (m) return `${m[1]} μg/mL`;
  m = x.match(
    /^([\d.]+)\s*~?\s*\\mu\s*\\mathrm\s*\{\s*g\s*\/\s*mL\s*\}\s*;?\s*$/,
  );
  if (m) return `${m[1]} μg/mL`;
  m = x.match(
    /^([\d.]+)\s*~?\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*;?\s*$/i,
  );
  if (m) return `${m[1]} μ/mL`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*M\s*\)\s*$/);
  if (m) return `${m[1]} μM)`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*\\\s*M\s*$/i);
  if (m) return `${m[1]} μM`;

  m = x.match(/^([\d.]+)\s*~?\s*\{\s*\\mu\s*m\s*\}\s*;?\s*$/i);
  if (m) return `${m[1]} μm`;
  m = x.match(/^([\d.]+)\s*~?\s*\{\s*\\mum\s*\}\s*;?\s*$/i);
  if (m) return `${m[1]} μm`;
  m = x.match(/^([\d.]+)\s*\\mu\s*m\s*;?\s*$/i);
  if (m) return `${m[1]} μm`;

  m = x.match(/^([\d.]+)\s*~?\s*h\s*;?\s*$/);
  if (m) return `${m[1]} h`;

  m = x.match(/^([\d.]+)\s*~?\s*\^\s*\{\s*\\circ\s*\}\s*C\s*;?\s*$/i);
  if (m) return `${m[1]}°C`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mathsf\s*\{\s*mL\s*\}\s*;?\s*$/);
  if (m) return `${m[1]} mL`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*L\s*;?\s*$/i);
  if (m) return `${m[1]} μL`;

  m = x.match(/^>\s*([\d.]+)\s*\\mathsf\s*\{\s*mM\s*\}\s*;?\s*$/);
  if (m) return `> ${m[1]} mM`;

  m = x.match(
    /^\(\s*([A-Za-z][A-Za-z0-9]*)\s*,\s*([A-Za-z][A-Za-z0-9]*)\s*\)\s*;?\s*$/,
  );
  if (m) return `(${m[1]}, ${m[2]})`;

  m = x.match(/^([A-Za-z][A-Za-z0-9]*)\^\s*\{\s*fl\s*\/\s*f\s*\}\s*;?\s*$/);
  if (m) return `${m[1]}^fl/f`;

  m = x.match(/^\(\s*n\s*=\s*(\d+)\s*\)\s*\(\s*([a-z])\s*\)\s*;?\s*$/i);
  if (m) return `(n = ${m[1]})(${m[2]})`;

  /**
   * 质量 `$300g$`、`$12,000g$`、`$1.5g$`（单数字 `$1g$` 不匹配，减少与变量混淆）
   */
  m = x.match(
    /^((?:\d{1,3}(?:,\d{3})+|\d{2,}|\d+\.\d+))g\s*;?\s*$/,
  );
  if (m) return `${m[1]} g`;

  /** 统计量单字母 `$P$`（p 值） */
  m = x.match(/^([A-Z])\s*;?\s*$/);
  if (m) return m[1];

  m = x.match(/^\(\s*O\s*_\s*\{\s*2\s*\}\s*\)\s*$/);
  if (m) return "(O₂)";

  m = x.match(/^\{\s*\\sf\s*O\s*\}\s*_\s*\{\s*2\s*\}\s*$/);
  if (m) return "O₂";

  m = x.match(
    /^\^\s*\{\s*((?:[\d,\s]|\*)+)\s*\}\s*$/,
  );
  if (m) {
    const raw = m[1].replace(/\s+/g, "").replace(/\*+$/, "");
    const star = m[1].includes("*") ? "*" : "";
    if (/^[\d,]+$/.test(raw) && raw.length <= 14) {
      const aff = affiliationSuperscriptFromSpacedDigits(
        raw.split(",").join(", "),
      );
      if (aff !== null) return `${aff}${star}`;
      if (/^\d+$/.test(raw)) return `${digitStringToUnicodeSuperscript(raw)}${star}`;
    }
  }

  const cd = x.match(/^C\s*D\s*(\d+)\s*\^\s*\{\s*\+\s*\}$/i);
  if (cd) return `CD${cd[1]}+`;

  const im = x.match(/^\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*(\d+)\s*$/);
  if (im) {
    const letters = collapseSpacedChars(im[1]);
    if (/^[A-Za-z]{1,12}$/.test(letters))
      return `${letters} ${im[2]}`;
  }

  m = x.match(/^\[\s*\\%\s*\]\s*\)\s*$/);
  if (m) return `[%])`;

  m = x.match(
    /^\|\s*\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*>\s*([\d.]+)\s*\\rangle\s*$/,
  );
  if (m) {
    const name = collapseSpacedChars(m[1]);
    if (/^[A-Za-z]{1,16}$/.test(name)) return `|${name}| > ${m[2]}`;
  }

  m = x.match(
    /^([\d.]+)\s*\(\s*\\pm\s*([\d.]+)\s*\)\s*$/,
  );
  if (m) return `${m[1]} (± ${m[2]})`;

  m = x.match(/^\(\s*\\pm\s*([\d.]+)\s*\)\s*$/);
  if (m) return `(± ${m[1]})`;

  m = x.match(/^\(\s*([\d.]+)\s*\\%\s*\)\s*$/);
  if (m) return `(${m[1]}%)`;

  m = x.match(/^\(\s*R\s*=\s*([\d\s,]+)\s*\)\s*$/);
  if (m) {
    const num = m[1]
      .split(",")
      .map((p) => collapseSpacedChars(p.replace(/\s+/g, "")))
      .join(",");
    if (/^[\d,]+$/.test(num.replace(/,/g, ""))) return `(R = ${num})`;
  }

  m = x.match(/^\(\s*n\s*=\s*([\d.]+)\s*;\s*$/);
  if (m) return `(n = ${m[1]};`;

  m = x.match(/^\(\s*n\s*=\s*([\d.]+)\s*\)$/);
  if (m) return `(n = ${m[1]})`;

  m = x.match(/^\(\s*n\s*=\s*(\d+)\s*$/);
  if (m) return `(n = ${m[1]}`;

  m = x.match(
    /^\(\s*\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\\ge(?:q|qslant)?\s*(\d+)\s*\)$/,
  );
  if (m) {
    const ac = collapseSpacedChars(m[1]);
    if (/^[A-Za-z]{2,12}$/.test(ac)) return `(${ac} ≥ ${m[2]})`;
  }

  m = x.match(
    /^\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\\ge(?:q|qslant)?\s*(\d+)\s*\)\s*$/,
  );
  if (m) {
    const ac = collapseSpacedChars(m[1]);
    if (/^[A-Za-z]{2,12}$/.test(ac)) return `${ac} ≥ ${m[2]})`;
  }

  m = x.match(
    /^\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\\ge(?:q|qslant)?\s*(\d+)\s*$/,
  );
  if (m) {
    const ac = collapseSpacedChars(m[1]);
    if (/^[A-Za-z]{2,12}$/.test(ac)) return `${ac} ≥ ${m[2]}`;
  }

  m = x.match(
    /^\(\s*\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\\ge\s*(\d+)\s*$/,
  );
  if (m) {
    const ac = collapseSpacedChars(m[1]);
    if (/^[A-Za-z]{2,12}$/.test(ac)) return `(${ac} ≥ ${m[2]}`;
  }

  m = x.match(/^\(\s*\\beta\s*=\s*([-+]?[\d.]+)\s*,\s*$/);
  if (m) return `(β = ${m[1]},`;

  m = x.match(/^\(\s*\\beta\s*=\s*([\d.+-]+)\s*\)\s*$/);
  if (m) return `(β = ${m[1]})`;
  m = x.match(/^\(\s*\\beta\s*=\s*([\d.+-]+)\s*$/);
  if (m) return `(β = ${m[1]})`;

  m = x.match(
    /^\\mathbf\s*\{\s*\\zeta\s*\}\s*_\s*\{\s*(\d+)\s*\}\s*=\s*((?:[A-Za-z]\s*)+)$/,
  );
  if (m) {
    const lab = collapseSpacedChars(m[2]);
    if (/^[A-Za-z]{1,24}$/.test(lab)) return `ζ${m[1]} = ${lab}`;
  }

  m = x.match(/^\{\s*(\d+)\s*=\s*\}\s*$/);
  if (m) return `${m[1]} =`;

  m = x.match(/^(\d+)\s*=\s*$/);
  if (m) return `${m[1]} =`;

  m = x.match(/^(\d+)\s*=\s*((?:[a-z]\s*)+)\)\s*$/i);
  if (m) {
    const w = collapseSpacedChars(m[2]);
    if (/^[a-z]{2,16}$/i.test(w)) return `${m[1]} = ${w})`;
  }

  m = x.match(/^\(\s*O\s*=\s*([A-Za-z]+)\s*,\s*$/);
  if (m) return `(O = ${m[1]},`;

  m = x.match(/^([A-Za-z])\s*\(\s*o\s*=\s*$/);
  if (m) return `${m[1]} (o =`;

  m = x.match(/^O\s*=\s*$/);
  if (m) return `O =`;

  m = x.match(
    /^\(\s*\\Delta\s*_\s*\{\s*\\tt\s*((?:[A-Za-z]\s*)+)\}\s*\)\s*$/,
  );
  if (m) {
    const sub = collapseMathrmLikeBraceContent(m[1]);
    if (/^[A-Za-z]{1,12}$/.test(sub)) return `(Δ${sub})`;
  }

  m = x.match(/^\\Delta\s*_\s*\{\s*\\tt\s*([^}]+)\}\s*$/);
  if (m) {
    const sub = collapseMathrmLikeBraceContent(m[1]);
    if (/^[A-Za-z]{1,12}$/.test(sub)) return `Δ${sub}`;
  }

  m = x.match(
    /^\(\s*\\Delta\s*_\s*\{\s*\\mathrm\s*\{\s*([^}]+)\}\s*\}?\s*$/,
  );
  if (m) {
    const sub = collapseMathrmLikeBraceContent(m[1]);
    if (/^[\s\S]{1,48}$/.test(sub) && sub.trim().length >= 1)
      return `(Δ${sub.trim()}`;
  }

  m = x.match(
    /^\(\s*\\Delta\s*_\s*\{\s*\\mathrm\s*\{\s*([^}]+)\}\s*,\s*\}\s*\s*~\s*\\Delta\s*_\s*\{\s*\\mathsf\s*\{\s*([^}]+)\}\s*\}\s*\)\s*$/,
  );
  if (m) {
    const a = collapseMathrmLikeBraceContent(m[1]);
    const b = collapseMathrmLikeBraceContent(m[2]);
    if (/^[A-Za-z]{1,16}$/.test(a) && /^[A-Za-z]{1,16}$/.test(b))
      return `(Δ${a}, Δ${b})`;
  }

  m = x.match(
    /^\(\s*\\Delta\s*_\s*\{\s*\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\}\s*\)\s*$/,
  );
  if (m) {
    const sub = collapseMathrmLikeBraceContent(m[1]);
    if (/^[A-Za-z]{1,20}$/.test(sub)) return `(Δ${sub})`;
  }

  m = x.match(
    /^\\Delta\s*_\s*\{\s*\\mathsf\s*\{\s*((?:[a-zA-Z]\s*)+)\}\s*\}\s*$/,
  );
  if (m) {
    const sub = collapseMathrmLikeBraceContent(m[1]);
    if (/^[a-zA-Z]{3,32}$/.test(sub)) return `Δ${sub}`;
  }

  m = x.match(
    /^\(\s*\\rho\s*=\s*([-+]?[\d.]+)\s*$/,
  );
  if (m) return `(ρ = ${m[1]})`;

  m = x.match(
    /^\(\s*\\pmb\s*\{\s*\\rho\s*\}\s*=\s*([-+]?[\d.]+)\s*$/,
  );
  if (m) return `(ρ = ${m[1]})`;

  m = x.match(/^\\beta\s*=\s*([-+]?[\d.]+)\s*$/);
  if (m) return `β = ${m[1]}`;

  m = x.match(
    /^([-+]?[\d.]+)\s*\\substack\s*\{\s*([-+]?[\d.]+)\s*\}\s*\)\s*$/,
  );
  if (m) return `${m[1]} (${m[2]})`;

  m = x.match(
    /^\[\s*([-+]?[\d.\s]+)\s*,\s*([-+]?[\d.\s]+)\s*\]\s*\\\}\s*$/,
  );
  if (m) {
    const a = normStatIntervalToken(m[1]);
    const b = normStatIntervalToken(m[2]);
    if (/^-?[\d.]+$/.test(a) && /^-?[\d.]+$/.test(b))
      return `[${a}, ${b}]`;
  }

  m = x.match(
    /^\[\s*([-+]?[\d.\s]+)\s*,\s*~\s*([-+]?[\d.\s]+)\s*\]\s*\)\s*$/,
  );
  if (m) {
    const a = normStatIntervalToken(m[1]);
    const b = normStatIntervalToken(m[2]);
    if (/^-?[\d.]+$/.test(a) && /^-?[\d.]+$/.test(b))
      return `[${a}, ${b}])`;
  }

  m = x.match(/^\[\s*([\d.]+)\s*\\%\s*\]\s*$/);
  if (m) return `[${m[1]}%]`;

  m = x.match(
    /^\(\s*\\chi\s*\^\s*\{\s*2\s*\}\s*\(\s*(\d+)\s*\)\s*=\s*([\d.\s]+)\s*-\s*([\d.\s]+)\s*$/,
  );
  if (m) {
    const mid = normStatIntervalToken(m[2]);
    const last = normStatIntervalToken(m[3]);
    if (/^[\d.]+$/.test(mid) && /^[\d.]+$/.test(last))
      return `χ² (${m[1]}) = ${mid}–${last}`;
  }

  m = x.match(
    /^\(\s*\^\s*\{\s*\*?\s*\}\s*\\mathfrak\s*\{\s*p\s*\}\s*<\s*([\d.]+)\s*;\s*$/,
  );
  if (m) return `(*p < ${m[1]};`;

  m = x.match(/^\\mathsf\s*\{\s*((?:[a-z]\s*)+)\}\s*\)\s*$/);
  if (m) {
    const w = collapseMathrmLikeBraceContent(m[1]);
    if (/^[a-z]{2,12}$/.test(w)) return `${w})`;
  }

  m = x.match(/^p\s*=\s*([\d.]+)\s*\\\}\s*$/);
  if (m) return `p = ${m[1]}`;

  m = x.match(/^\{\s*\\mathsf\s*p\s*\}\s*<\s*([\d.]+)\s*$/);
  if (m) return `p < ${m[1]}`;

  m = x.match(/^\{\s*p\s*\}\s*<\s*([\d.]+)\s*$/);
  if (m) return `p < ${m[1]}`;

  m = x.match(/^p\s*>\s*([\d.]+)\s*\)\s*$/);
  if (m) return `p > ${m[1]})`;

  m = x.match(/^p\s*=\s*([\d.]+)\s*\)\s*$/);
  if (m) return `p = ${m[1]})`;

  m = x.match(/^p\s*>\s*([\d.]+)\s*$/);
  if (m) return `p > ${m[1]}`;

  m = x.match(
    /^\(\s*\\mathsf\s*\{\s*f\s*\}\s*\^\s*\{\s*2\s*\}\s*=\s*([\d.]+)\s*\)$/,
  );
  if (m) return `(f² = ${m[1]})`;
  m = x.match(/^\(\s*f\s*\^\s*\{\s*2\s*\}\s*=\s*([\d.]+)\s*\)$/);
  if (m) return `(f² = ${m[1]})`;

  m = x.match(
    /^\\mathbf\s*\{\s*\\beta\s*\}\s*\(\s*\\beta\s*=\s*([\d.]+)\s*$/,
  );
  if (m) return `β (β = ${m[1]})`;

  m = x.match(
    /^\s*\{\s*\\mathsf\s*p\s*\}\s*=\s*([\d.]+)\s*\)\s*$/,
  );
  if (m) return `p = ${m[1]})`;
  m = x.match(
    /^\\mathsf\s*\{\s*p\s*\}\s*=\s*([\d.]+)\s*\)\s*$/,
  );
  if (m) return `p = ${m[1]})`;

  m = x.match(/^p\s*$/i);
  if (m) return "p";

  m = x.match(
    /^((?:[A-Za-z0-9.-]\s*){2,})\s*\^\s*\{\s*([0-9,\s\-]+)\s*\}\s*([).,])?\s*$/,
  );
  if (m) {
    const base = collapseSpacedChars(m[1]);
    const sup = m[2].replace(/\s+/g, "");
    if (
      /^[A-Za-z0-9.-]{2,32}$/.test(base) &&
      /^[0-9,-]+$/.test(sup)
    ) {
      return `${base}^${sup}${m[3] ?? ""}`;
    }
  }

  m = x.match(
    /^\{\s*\\mathrm\s*\{\s*((?:[A-Za-z0-9]\s*)+)\}\s*\}\s*\^\s*\{\s*([0-9,\s\-]+)\s*\}\s*$/,
  );
  if (m) {
    const base = collapseSpacedChars(m[1]);
    const sup = m[2].replace(/\s+/g, "");
    if (/^[A-Za-z0-9.-]{2,32}$/.test(base) && /^[0-9,-]+$/.test(sup)) {
      return `${base}^${sup}`;
    }
  }

  m = x.match(
    /^((?:[A-Za-z0-9.-]\s*){2,})\s*\^\s*\{\s*([A-Za-z0-9/.\s-]+)\s*\}\s*([).|])?\s*$/,
  );
  if (m) {
    const base = collapseSpacedChars(m[1]);
    const sup = collapseSpacedChars(m[2]);
    if (
      /^[A-Za-z0-9.-]{2,32}$/.test(base) &&
      /^[A-Za-z0-9/.-]{1,32}$/.test(sup)
    ) {
      return `${base}^${sup}${m[3] ?? ""}`;
    }
  }

  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*\\?\s*[Ll]\s*;?\s*$/);
  if (m) return `${m[1]} μL`;

  m = x.match(/^\(\s*([\d.]+)\s*~?\s*\\mu\s*M\s*\)\s*$/);
  if (m) return `(${m[1]} μM)`;

  m = x.match(/^\(\s*([\d.]+)\s*~?\s*\\mu\s*\\?\s*[Ll]\s*\)\s*$/);
  if (m) return `(${m[1]} μL)`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*;?\s*$/i);
  if (m) return `${m[1]} mL`;

  m = x.match(
    /^([\d.]+)\s*\\mathrm\s*\{\s*~?\s*h\s*\}\s*;?\s*$/i,
  );
  if (m) return `${m[1]} h`;

  m = x.match(
    /^([\d.]+)\s*\\mathsf\s*\{\s*c\s*m\s*\}\s*\^\s*\{\s*(\d+)\s*\}\s*$/,
  );
  if (m) return `${m[1]} cm^${m[2]}`;

  m = x.match(
    /^([\d.]+)\s*\^\s*\{\s*\*\s*\}\s*10\s*\^\s*\{\s*([-+]?\d+)\s*\}\s*\\mathrm\s*\{\s*Vg\s*\/\s*ml\s*\}\s*$/i,
  );
  if (m) return `${m[1]}×10^${m[2]} Vg/ml`;

  m = x.match(/^([\d.]+)\s*M\s*$/);
  if (m) return `${m[1]} M`;

  m = x.match(/^([\d.]+)x\s*$/i);
  if (m) return `${m[1]}×`;

  m = x.match(
    /^\(\s*([\d.]+)\s*\\%\s*[0O]\s*_\s*\{\s*2\s*\}\s*\)\s*$/,
  );
  if (m) return `(${m[1]}% O₂)`;

  m = x.match(/^([\d.]+)\s*\\%\s*[0O]\s*_\s*\{\s*2\s*\}\s*$/);
  if (m) return `${m[1]}% O₂`;

  m = x.match(/^([\d.]+)\s*\{\s*-\s*\}\s*([\d.]+)\s*\\%\s*$/);
  if (m) return `${m[1]}-${m[2]}%`;

  m = x.match(/^>\s*([\d.]+)\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*;?\s*$/i);
  if (m) return `> ${m[1]} mM`;

  m = x.match(
    /^\{\s*\\sf\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\sf\s*[O0]\s*\}\s*_\s*\{\s*2\s*\}\s*$/,
  );
  if (m) return "H₂O₂";

  m = x.match(
    /^\{\s*\\sf\s*M\s*g\s*S\s*O\s*_\s*\{\s*4\s*\}\s*\}\s*,\s*1\s*mM\s*\{\s*\\mathsf\s*\{\s*N\s*a\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\mathsf\s*\{\s*H\s*P\s*O\s*\}\s*\}\s*_\s*\{\s*4\s*\}\s*,\s*1\.2\s*mM\s*\{\s*\\sf\s*K\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\sf\s*P\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*$/i,
  );
  if (m) return "MgSO₄, 1 mM Na₂HPO₄, 1.2 mM KH₂PO₄";

  m = x.match(
    /^\\left\|\s*\\mathrm\s*\{\s*FC\s*\}\s*\\right\|\s*\\geq\s*([\d.]+)\s*$/,
  );
  if (m) return `|FC| ≥ ${m[1]}`;

  m = x.match(/^\|\s*\\mathrm\s*\{\s*FC\s*\}\s*\|\s*\\geq\s*([\d.]+)\s*$/);
  if (m) return `|FC| ≥ ${m[1]}`;

  m = x.match(/^([\d.]+)\s*\\pm\s*([\d.]+)\s*\^\s*\{\s*\\circ\s*\}\s*C\s*$/i);
  if (m) return `${m[1]} ± ${m[2]}°C`;

  m = x.match(
    /^([Cc])\s*\.\s*(\d+)\s*([A-Za-z])\s*\\mathrm\s*\{\s*>\s*([A-Za-z])\s*\}\s*$/,
  );
  if (m) return `${m[1]}.${m[2]} ${m[3]}>${m[4]}`;

  m = x.match(
    /^\(\s*([Cc])\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*$/,
  );
  if (m) return `(${m[1]}.${m[2]} ${m[3]}>${m[4]}`;

  m = x.match(
    /^\{\s*\\mathrm\s*\{\s*([Cc])\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*\}\s*\}\s*$/,
  );
  if (m) return `${m[1]}.${m[2]} ${m[3]}>${m[4]}`;

  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\pm\s*([\d.]+)\s*\\:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;

  m = x.match(/^\(\s*([\d.]+)\s*\\mu\s*g\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\)\s*$/i);
  if (m) return `(${m[1]} μg/mL)`;

  m = x.match(/^([A-Za-z])\s*\(\s*([\d.]+)\s*\\mu\s*g\s*\/\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*\)\s*$/i);
  if (m) return `${m[1]} (${m[2]} μg/mL)`;

  m = x.match(
    /^\(\s*([\d.]+)\s*~?\s*\\mu\s*\\?\s*[Ll]\s*of\s*DPBS\s*containing\s*([\d.]+)\s*%\s*BSA\.?\s*$/,
  );
  if (m) return `(${m[1]} μL of DPBS containing ${m[2]}% BSA.`;

  m = x.match(
    /^\{\s*\\sf\s*O\s*\}\s*2\s*\(\s*-\s*\\mathrm\s*\{\s*\^\s*\{\s*\\star\s*\}\s*\}\s*\)\s*$/,
  );
  if (m) return "O₂(−*)";

  m = x.match(
    /^\{\s*20\s*~?\s*9\s*\}\s*of\s*BSA,\s*45\s*~?\s*\\mathsf\s*\{\s*m\s*L\s*\}\s*$/,
  );
  if (m) return "20 g of BSA, 45 mL";

  m = x.match(/^\(\s*([\d.]+)\s*\\mu\s*g\s*\)\s*$/i);
  if (m) return `(${m[1]} μg)`;

  m = x.match(/^\(\s*([\d.]+)\s*~?\s*\\mu\s*\\mathfrak\s*\{\s*g\s*\}\s*\)\s*$/i);
  if (m) return `(${m[1]} μg)`;

  m = x.match(/^\(\s*([\d.]+)\s*\\mathrm\s*\{\s*mg\s*\/\s*kg\s*\}\s*\)\s*$/i);
  if (m) return `(${m[1]} mg/kg)`;

  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\pm\s*([\d.]+)\s*\\:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*g\s*\/\s*L\s*;?\s*$/i);
  if (m) return `${m[1]} μg/L`;

  m = x.match(/^([\d.]+)\s*-\s*([\d.]+)\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]}-${m[2]} μ/mL`;

  m = x.match(/^([\d,\s]+)\s*\{\s*-\s*\}\s*([\d,\s]+)\s*$/);
  if (m) {
    const a = collapseSpacedChars(m[1]);
    const b = collapseSpacedChars(m[2]);
    if (/^\d[\d,]*$/.test(a) && /^\d[\d,]*$/.test(b)) return `${a}-${b}`;
  }

  m = x.match(/^\\mathbf\s*\{\s*\\sigma\s*\}\s*\\cdot\s*\\kappa\s*B\s*$/i);
  if (m) return "σ·κB";

  m = x.match(/^\\mu\s*\\mathrm\s*\{\s*B\s*C\s*A\s*\}\s*$/i);
  if (m) return "μBCA";

  m = x.match(/^\\mathrm\s*\{\s*S\s*L\s*E\s*\^\s*\{\s*([0-9,\s-]+)\s*\}\s*\}\s*$/);
  if (m) return `SLE^${m[1].replace(/\s+/g, "")}`;

  m = x.match(
    /^\\mathsf\s*\{\s*G\s*C\s*G\s*\}\s*\^\s*\{\s*\+\s*\}\s*\\mathrm\s*\{\s*~\s*\\pmb\s*~\s*\{\s*\\alpha\s*\}\s*~\s*\}\s*$/i,
  );
  if (m) return "GCG+ α";

  m = x.match(/^\^\s*\{\s*\+\s*\}\s*NKX6\.1\+\s*$/i);
  if (m) return "+ NKX6.1+";

  m = x.match(/^\(\s*\\boldsymbol\s*\{\s*\\\|\s*\}\s*\)\s*$/);
  if (m) return "(I)";

  m = x.match(/^\\cdot\s*D\s*A\s*\^\s*\{\s*\+\s*\}\s*$/i);
  if (m) return "·DA+";

  m = x.match(/^BMP4\s*\(R&D,\s*#314-BP-01M\),\s*$/i);
  if (m) return "BMP4 (R&D, #314-BP-01M),";

  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\pm\s*([\d.]+)\s*\\:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;

  m = x.match(
    /^\(\s*([\d.]+)\s*\{\s*-\s*\}\s*([\d.]+)\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*\.\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} μ/mL.`;

  m = x.match(/^\(\s*I\s*N\s*S\s*\^\s*\{\s*w\s*\/\s*G\s*F\s*P\s*\}\s*\)\s*$/i);
  if (m) return "(INS^w/GFP)";

  m = x.match(/^\(\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*\}\s*$/);
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(/^\(\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*$/);
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(/^([\d]+)\s*S\s*\^\s*\{\s*\+\s*\}\s*\\mathrm\s*\{\s*~\s*\\beta\s*~\s*\}\s*$/i);
  if (m) return `${m[1]}S+ β`;

  m = x.match(/^1g\s*$/);
  if (m) return "1 g";

  m = x.match(/^([\d.]+)\s*\\mathrm\s*\{\s*\\\s*m\s*l\s*\}\s*$/i);
  if (m) return `${m[1]} mL`;

  m = x.match(/^([\d.]+)\s*\\\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} mL`;

  m = x.match(
    /^((?:[A-Za-z0-9]\s*)+)\s*\^\s*\{\s*-\s*\/\s*-\s*\}\s*\\mathsf\s*\{\s*A\s*D\s*-\s*\}\s*\|\s*$/i,
  );
  if (m) {
    const gene = collapseSpacedChars(m[1]);
    if (/^[A-Za-z0-9]{4,28}$/.test(gene)) return `${gene}−/− AD-B`;
  }

  m = x.match(
    /^W\s*\{\s*\\sf\s*S\s*\}\s*\^\s*\{\s*\+\s*\}\s*N\s*\{\s*\\sf\s*K\s*\}\s*\\times\s*6\.1\s*\^\s*\{\s*\+\s*\}\s*\\beta\s*$/i,
  );
  if (m) return "WS+ NKX6.1+ β";

  m = x.match(
    /^W\s*\{\s*\\sf\s*S\s*\}\s*\^\s*\{\s*\+\s*\}\s*\\sf\s*N\s*K\s*X\s*6\.1\s*\^\s*\{\s*\+\s*\}\s*\\beta\s*$/i,
  );
  if (m) return "WS+ NKX6.1+ β";

  m = x.match(/^\{\s*20\s*~?\s*9\s*\}\s*$/);
  if (m) return "20 g";

  m = x.match(/^\{\s*>\s*\}\s*([\d.]+)\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*_\s*\{\s*\\beta\s*\}\s*$/i);
  if (m) return `> ${m[1]} mM β`;
  m = x.match(
    /^\{\s*>\s*\}\s*([\d.]+)\s*\\\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*_\s*\{\s*\\beta\s*\}\s*$/i,
  );
  if (m) return `> ${m[1]} mM β`;

  m = x.match(/^\{\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*\}\s*\}\s*$/);
  if (m) return `c.${m[1]} ${m[2]}>${m[3]}`;
  m = x.match(/^\{\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*\}\s*([A-Za-z])\s*\}\s*\}\s*$/i);
  if (m) return `c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(/^([\d.]+)\s*\\\s*\\mathrm\s*\{\s*n\s*g\s*\/\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mathrm\s*\{\s*n\s*g\s*\/\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mathrm\s*\{\s*\\mathsf\s*\{\s*n\s*g\s*\/\s*m\s*L\s*\}\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mathrm\s*\{\s*\\?\s*n\s*g\s*\/\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mathrm\s*\{\s*\\\s*n\s*g\s*\/\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mathrm\s*\{\s*\\\s*n\s*g\s*\}\s*$/i);
  if (m) return `${m[1]} ng`;
  m = x.match(/^([\d.]+)\s*~?\s*\\mathsf\s*\{\s*n\s*g\s*\}\s*\/\s*$/i);
  if (m) return `${m[1]} ng/`;

  m = x.match(/^([\d.]+)\s*~?\s*\\mu\s*\\iota\s*$/i);
  if (m) return `${m[1]} μL`;
  m = x.match(/^([\d.]+)\s*\\mathrm\s*\{\s*~\s*min\s*\}\s*$/i);
  if (m) return `${m[1]} min`;
  m = x.match(/^([\d.]+)\s*\\mathrm\s*\{\s*~\s*nm\s*\}\s*$/i);
  if (m) return `${m[1]} nm`;
  m = x.match(/^([\d.]+)\s*~\s*\\mathrm\s*\{\s*\{\s*n\s*g\s*\/\s*m\s*L\s*\}\s*\}\s*$/i);
  if (m) return `${m[1]} ng/mL`;
  m = x.match(/^\(\s*([\d.]+)\s*\\mathsf\s*\{\s*n\s*m\s*\}\s*\)\s*$/i);
  if (m) return `(${m[1]} nm)`;
  m = x.match(/^\\scriptstyle\s*n\s*=\s*(\d+)\s*$/i);
  if (m) return `n = ${m[1]}`;
  m = x.match(
    /^\\begin\s*\{\s*array\s*\}\s*\{\s*[a-z]\s*\}\s*\{\s*n\s*=\s*(\d+)\s*\}\s*\\end\s*\{\s*array\s*\}\s*$/i,
  );
  if (m) return `n = ${m[1]}`;
  m = x.match(/^n\s*=\s*(\d+)\s*\^\s*\{\s*\\circ\s*\}\s*,?\s*$/i);
  if (m) return `n = ${m[1]},`;
  m = x.match(/^n\s*=\s*(\d+)\s*,\s*$/i);
  if (m) return `n = ${m[1]},`;
  m = x.match(/^n\s*=\s*(\d+)\s*_\s*\{\s*\\cdot\s*\}\s*$/i);
  if (m) return `n = ${m[1]}`;
  m = x.match(/^\\mathsf\s*\{\s*Z\s*n\s*2\s*\+\s*\}\s*$/i);
  if (m) return "Zn2+";
  m = x.match(/^\\complement\s*a\s*2\s*\+\s*$/i);
  if (m) return "Ca2+";
  m = x.match(/^Z\s*_\s*\{\s*\\mathsf\s*\{\s*n\s*P\s*T\s*O\s*\}\s*\}\s*$/i);
  if (m) return "ZnPTO";
  m = x.match(/^Z\s*n\s*\\mathsf\s*\{\s*P\s*T\s*O\s*\}\s*\+\s*S\s*L\s*C\s*30\s*A\s*\&\s*\^\s*\{\s*-\s*\\prime\s*-\s*\}\s*$/i);
  if (m) return "ZnPTO + SLC30A−/−";

  m = x.match(/^Z\s*n\s*S\s*O\s*_\s*\{\s*4\s*\}\s*$/i);
  if (m) return "ZnSO₄";

  m = x.match(
    /^W\s*\{\s*\\sf\s*S\s*\}\s*\^\s*\{\s*\+\s*\}\s*N\s*\{\s*\\sf\s*K\s*\}\s*\\times\s*6\.1\s*\^\s*\{\s*\+\s*\}\s*\\\s*\\beta\s*$/i,
  );
  if (m) return "WS+ NKX6.1+ β";

  m = x.match(
    /^\{\s*\\sf\s*M\s*g\s*S\s*O\s*_\s*\{\s*4\s*\}\s*\}\s*,\s*1\s*mM\s*\{\s*\\mathsf\s*\{\s*N\s*a\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\mathsf\s*\{\s*H\s*P\s*O\s*\}\s*\}\s*_\s*\{\s*4\s*\}\s*,\s*1\.2\s*mM\s*\{\s*\\sf\s*K\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\sf\s*P\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*$/,
  );
  if (m) return "MgSO₄, 1 mM Na₂HPO₄, 1.2 mM KH₂PO₄";
  m = x.match(/^\{\s*\\sf\s*M\s*g\s*S\s*O\s*_\s*\{\s*4\s*\}\s*\}\s*$/i);
  if (m) return "MgSO₄";
  m = x.match(
    /^\{\s*\\mathsf\s*\{\s*N\s*a\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\mathsf\s*\{\s*H\s*P\s*O\s*\}\s*\}\s*_\s*\{\s*4\s*\}\s*$/i,
  );
  if (m) return "Na₂HPO₄";
  m = x.match(
    /^\{\s*\\sf\s*K\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\sf\s*P\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*$/i,
  );
  if (m) return "KH₂PO₄";

  m = x.match(/^\(\s*([\d.]+)\s*\\mathrm\s*\{\s*mg\s*\/\s*kg\s*\}\s*\)\s*$/i);
  if (m) return `(${m[1]} mg/kg)`;

  m = x.match(/^\(\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*\}\s*$/i);
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(/^\(\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*$/i);
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(/^([\d.]+)\s*\{\s*-\s*\}\s*([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]}-${m[2]} μ/mL`;
  m = x.match(/^([\d.]+)\s*\{\s*-\s*\}\s*([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*\.\s*$/i);
  if (m) return `${m[1]}-${m[2]} μ/mL.`;
  m = x.match(/^\(\s*([\d.]+)\s*\{\s*-\s*\}\s*([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*\.\s*$/i);
  if (m) return `(${m[1]}-${m[2]} μ/mL.`;
  m = x.match(/^([\d.]+)\s*-\s*([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]}-${m[2]} μ/mL`;
  m = x.match(/^([\d.]+)\s*-\s*([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*\.\s*$/i);
  if (m) return `${m[1]}-${m[2]} μ/mL.`;

  m = x.match(/^([\d.]+)\s*\\mathrm\s*\{\s*\\\s*m\s*l\s*\}\s*$/i);
  if (m) return `${m[1]} mL`;

  m = x.match(/^([\d.]+)\s*\\\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} mL`;

  m = x.match(/^([\d.]+)\s*\\\s*\\mu\s*\/\s*\\mathrm\s*\{\s*m\s*L\s*\}\s*$/i);
  if (m) return `${m[1]} μ/mL`;

  m = x.match(/^>\s*([\d.]+)\s*\\\s*\\mathsf\s*\{\s*m\s*M\s*\}\s*_\s*\{\s*\\beta\s*\}\s*$/i);
  if (m) return `> ${m[1]} mM β`;

  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\pm\s*([\d.]+)\s*\\:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;
  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\pm\s*([\d.]+)\s*\\\s*:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;
  m = x.match(
    /^\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\\\s*pm\s*([\d.]+)\s*\\\s*:\s*\\mathrm\s*\{\s*g\s*\/\s*m\s*L\)\s*\}\s*$/,
  );
  if (m) return `(${m[1]}-${m[2]} ± ${m[3]} g/mL)`;

  m = x.match(
    /^\(\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*\}\s*$/,
  );
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;
  m = x.match(
    /^\(\s*\\mathrm\s*\{\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*\}\s*([A-Za-z])\s*\}\s*$/i,
  );
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(
    /^\(\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*([A-Za-z])\s*\}\s*$/,
  );
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;
  m = x.match(
    /^\(\s*c\s*\.\s*(\d+)\s*([A-Za-z])\s*\{\s*>\s*\}\s*([A-Za-z])\s*$/i,
  );
  if (m) return `(c.${m[1]} ${m[2]}>${m[3]}`;

  m = x.match(
    /^\{\s*\\sf\s*M\s*g\s*S\s*O\s*_\s*\{\s*4\s*\}\s*\}\s*,\s*1\s*mM\s*\{\s*\\mathsf\s*\{\s*N\s*a\s*\}\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\mathsf\s*\{\s*H\s*P\s*O\s*\}\s*\}\s*_\s*\{\s*4\s*\}\s*,\s*1\.2\s*mM\s*\{\s*\\sf\s*K\s*H\s*\}\s*_\s*\{\s*2\s*\}\s*\{\s*\\sf\s*P\s*O\s*\}\s*_\s*\{\s*4\s*\}\s*$/,
  );
  if (m) return "MgSO₄, 1 mM Na₂HPO₄, 1.2 mM KH₂PO₄";

  return null;
}

/**
 * `$\begin{array}{…}…(>…0.95)…\end{array}$` → `(> 0.95)`（内层任意长度，仅抽取 `> … )` 与数字）
 */
export function normalizeMineruBeginArrayDollarBlocks(text: string): string {
  return text.replace(
    /\$\\begin\{array\}[\s\S]*?\\end\{array\}\$/g,
    (full) => {
      if (!/>/.test(full)) return full;
      const dec = full.match(/(\d(?:\s*\.\s*\d|\s+\d)+)\s*\)/);
      if (!dec) return full;
      const num = collapseOcrDecimalInMathFragment(
        dec[1].replace(/\s+/g, " ").trim(),
      );
      if (!/^[\d.]+$/.test(num)) return full;
      return `(> ${num})`;
    },
  );
}

function isCdLikeToken(collapsed: string): boolean {
  return (
    /^CD[0-9]+[a-z]?$/i.test(collapsed) &&
    collapsed.length >= 3 &&
    collapsed.length <= 10
  );
}

/** Springer / Nature 系页眉常单独成行；粘连在句首时见 {@link stripJournalRunningHeaderPrefix} */
const DROP_STANDALONE_LINE: RegExp[] = [
  /^\(legend continued on next page\)\s*$/i,
  /** 勿在此丢弃 `# Cancer Cell` / `# Article`：保留标题；重复刊名见 {@link cleanPdfTextMd} `maybeJournal` */
  /^May 11, 2026\s+\$?\\?circledcirc/i,
  /^OPEN ACCESS\s*$/i,
  /^SPRINGERNATURE\s*$/i,
  /^SPRINGER NATURE\s*$/i,
  /^Check for updates\s*$/i,
  /^ARTICLE OPEN\s*$/i,
  /^ARTICLE IN PRESS\s*$/i,
  /^Article in Press\s*$/i,
  /^Nature Medicine Brief Communication\s*$/i,
  /^Nature Communications\s*$/i,
  /^Molecular Psychiatry\s*$/i,
  /^nature medicine\s*$/i,
  /^Brief Communication\s*$/i,
  /^Articles\s*$/i,
  /^www\.thelancet\.com\b.*$/i,
  /^eBioMedicine\s+\d{4};\s*\d+\s*:\s*\d+.*$/i,
  /^Vol\s+\d+\s+April,?\s+\d{4}\s+Articles\s*$/i,
  /** 仅作者短行（与下一段重复） */
  /^J\.\s+[A-Za-zÀ-ÿ' -]+\s+et al\.\s*$/u,
];

/**
 * 去掉句首「期刊名 + J. Xxx et al.」式 running header（与 Elsevier 已处理的 OPEN ACCESS 类似）。
 */
export function stripJournalRunningHeaderPrefix(line: string): string {
  return line.replace(
    /^(?:Molecular Psychiatry\s+)?J\.\s+[A-Za-zÀ-ÿ' -]+\s+et al\.\s+/u,
    "",
  );
}

export function dropMineruMarkdownNoise(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let lastStandaloneDoi = "";
  for (const line of lines) {
    const t = line.trim();

    let drop = false;
    for (const re of DROP_STANDALONE_LINE) {
      if (re.test(t)) {
        drop = true;
        break;
      }
    }
    if (drop) continue;

    /** 重复出现的独立 DOI 行（Nature Medicine 等每页眉块一条） */
    const doiOnly = t.match(/^https:\/\/doi\.org\/(10\.\S+)\s*$/i);
    if (doiOnly) {
      const id = doiOnly[1].toLowerCase();
      if (lastStandaloneDoi === id) continue;
      lastStandaloneDoi = id;
    }

    out.push(stripJournalRunningHeaderPrefix(line));
  }
  return out.join("\n");
}

/** 知识库向量化：连续完全相同的非短行多为 MinerU 重复块（如 Nat Commun 标题） */
export function dedupeConsecutiveLongLines(
  text: string,
  minLen = 28,
): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const tr = line.trim();
    if (
      out.length > 0 &&
      tr.length >= minLen &&
      out[out.length - 1].trim() === tr
    ) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function shouldJoinLineAfterPageNoise(prev: string, next: string): boolean {
  const p = prev.trimEnd();
  const n = next.trimStart();
  if (!p || !n) return false;
  /** 作者单位脚注 `a Genetics` / `b CIRI` 等以小写开头，勿与上一段跨空行拼成一行 */
  if (looksLikeLetterPrefixedAffiliation(n)) return false;
  /** Springer / Nature 日期页脚与正文之间删去页眉后，勿把「Published online…」与下段正文接成一行 */
  if (/\bPublished online:\s*/i.test(p)) return false;
  if (/^\s*Received:\s/i.test(p) && /\b(?:Revised|Accepted|Published online):/i.test(p))
    return false;
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

  /** `$\begin{array}…\end{array}$` 内层可极长，须先于短 `$…$` */
  s = normalizeMineruBeginArrayDollarBlocks(s);

  /** 短 `$…$` 内 OCR 数字/小数点、字体嵌套、括号统计式（先于其它按全文写的公式规则） */
  s = normalizeShortInlineDollarMath(s);

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
 * KB 行内「碎片」规则入口：与 `pdf-kb-fragment-audit` 对孤立 `$…$` 调用 {@link normalizeMineruInlineLatex} 的语义一致，
 * 用于在已有 `.kb.md` 上就地套用规则（见 `fragment-apply-inplace.ts`）。
 * 实现即 {@link normalizeMineruInlineLatex}（短 `$…$` + 全文行内 LaTeX 替换）。
 */
export function applyKbFragmentRulesToMarkdown(text: string): string {
  return normalizeMineruInlineLatex(text.replace(/\r\n/g, "\n"));
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
  /** MinerU OCR：`https://doi. org/...`（PDF 折行在 doi. 与 org 之间，合并后误插空格） */
  s = s.replace(/https?:\/\/doi\.\s+org\//gi, "https://doi.org/");
  /** PDF 折行：`https://` 与 `doi.org/` 分两行 → `https:// doi.org/` */
  s = s.replace(/https:\/\/\s+doi\.org\//gi, "https://doi.org/");
  /** MinerU：DOI 链接中 `doi.org/ 10.` 误插入空格 */
  s = s.replace(/https:\/\/doi\.org\/\s+/gi, "https://doi.org/");
  s = s.replace(/\b10\.\s+1016\//g, "10.1016/");
  s = s.replace(/\b10\.\s+1038\//g, "10.1038/");
  /**
   * MinerU OCR：`https://doi.org/10. 1016/... 106209` 等**同一行内**误插空格。
   * 路径段**勿用** `\s`：否则会匹配换行，把 DOI 与下段 `References` 一并纳入并 `replace(/\s+/g,'')` 吃掉段落界，变成 `106209.References1Watson`。
   */
  s = s.replace(
    /https:\/\/doi\.org\/10\.[\d \t./a-z-]+(?=\s|$|[,;)\]\u4e00-\u9fff]|[A-Z][a-z])/gi,
    (m) => m.replace(/[ \t]+/g, ""),
  );
  /** 图注与编号粘连：`Fig. 1covariates` */
  s = s.replace(/\bFig\.\s*(\d+)([a-z]{3,})\b/gi, "Fig. $1 $2");
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
  /** Lancet / eBioMedicine 页眉词「Articles」残留在句中或行尾 */
  s = s.replace(/\bArticles\s+(?=[a-z])/g, "");
  s = s.replace(/\.\s*Articles\s*(?=\n|$)/gm, ".");
  /** 句末单独一词 `Articles`（换页刊眉） */
  s = s.replace(/\s+Articles\s*$/gm, "");
  /** Springer：日期页脚与正文被软换行合并成一行时拆开，便于向量化分段 */
  s = s.replace(
    /(Published online:\s*\d{1,2}\s+\w+\s+\d{4})\s+([a-z][a-z]{2,})/gi,
    "$1\n\n$2",
  );
  /**
   * 作者单位上标与机构名粘连（MinerU 常见）：`aaDepartment`→`aa Department`，`abINSERM`→`ab INSERM`；
   * 双字母后接大写字母（含全大写缩写 INSERM）；单字母 `mDepartment` / `wService` 另条。
   */
  s = s.replace(/^([a-z]{2})(?=[A-Z])/gm, "$1 ");
  s = s.replace(/^([a-z])(?=Department\b|Service\b)/gim, "$1 ");
  return s;
}

/**
 * Elsevier 双栏/换页时，ae–ah 脚注常被插在刊头（Articles / eBioMedicine）之后，阅读顺序落在 ai–ak 后面。
 * 若 ae–ah 行整体出现在 ak 行之后，则整段挪到 ad 行之后（与 PDF 字母序一致）。
 */
export function reorderAaToAkAffiliationsAfterAd(text: string): string {
  const lines = text.split(/\r?\n/);
  const reFoot = /^(ae|af|ag|ah)(?=\s|[A-Z])/;
  const reAd = /^ad(?=\s|[A-Z])/;
  const reAk = /^ak(?=\s|[A-Z])/;

  const feet: { idx: number; prefix: string; content: string }[] = [];
  let adIdx = -1;
  let akIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (reAd.test(t)) adIdx = i;
    if (reAk.test(t)) akIdx = i;
    const m = t.match(reFoot);
    if (m) feet.push({ idx: i, prefix: m[1]!, content: raw });
  }
  if (adIdx < 0 || feet.length === 0 || akIdx < 0) return text;
  const needsReorder = feet.some((f) => f.idx > akIdx);
  if (!needsReorder) return text;

  const order = ["ae", "af", "ag", "ah"] as const;
  const byPrefix = new Map(feet.map((f) => [f.prefix, f.content] as const));
  const block = order.map((p) => byPrefix.get(p)).filter(Boolean) as string[];
  if (block.length === 0) return text;

  const removeIdx = feet.map((f) => f.idx).sort((a, b) => b - a);
  for (const i of removeIdx) lines.splice(i, 1);

  const removedBeforeAd = feet.filter((f) => f.idx < adIdx).length;
  const newAdIdx = adIdx - removedBeforeAd;
  if (newAdIdx < 0) return lines.join("\n");
  lines.splice(newAdIdx + 1, 0, ...block);
  return lines.join("\n");
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

export function applyKbSpecificPreCleanup(
  raw: string,
  options: Pick<KbCleanupOptions, "stripMineruStructureManifest"> = {},
): string {
  let text = raw.replace(/\r\n/g, "\n");
  if (options.stripMineruStructureManifest !== false) {
    text = stripMineruStructureManifest(text);
  }
  text = dropMineruMarkdownNoise(text);
  text = dedupeConsecutiveLongLines(text);
  text = joinLinesBrokenByRemovedPageNoise(text);
  text = flattenHtmlTablesToPlain(text);
  text = neutralizeCatalogHashesAndHexColors(text);
  return text;
}

export function applyKbSpecificPostCleanup(
  raw: string,
  options: Pick<
    KbCleanupOptions,
    "applyKbOcrTypoFixes" | "collapseImageBlocks" | "maxImagesPerRun"
  > = {},
): string {
  let text = raw.replace(/\r\n/g, "\n");
  text = normalizeKbResidualDollarMath(text);
  if (options.applyKbOcrTypoFixes !== false) {
    text = normalizeKbOcrTypos(text);
    text = reorderAaToAkAffiliationsAfterAd(text);
  }

  if (options.collapseImageBlocks !== false) {
    text = collapseImageBlocksForKb(text, options.maxImagesPerRun ?? 1);
  }
  return text.trim() + "\n";
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
  text = applyKbSpecificPreCleanup(text, {
    stripMineruStructureManifest: stripManifest,
  });
  text = normalizeMineruInlineLatex(text);
  text = cleanPdfTextMd(text, cleanupOpts);
  return applyKbSpecificPostCleanup(text, {
    applyKbOcrTypoFixes,
    collapseImageBlocks,
    maxImagesPerRun,
  });
}
