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

  s = s.replace(
    /\$\s*\{\s*\\mathsf\s*\{\s*((?:[A-Za-z]\s*)+)\}\s*\}\s*\^\s*\{\s*\+\s*\}\s*\$/g,
    (full, body: string) => {
      const t = collapseSpacedChars(body);
      if (/^[A-Z]{2,8}\d{0,2}$/i.test(t) || /^CXCL\d+$/i.test(t))
        return `${t}+`;
      return full;
    },
  );

  s = s.replace(/\$\s*\\mathsf\s*\{\s*T\s*\}\s*=\s*\$/gi, "T =");

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
  text = normalizeMineruInlineLatex(text);
  text = cleanPdfTextMd(text, cleanupOpts);

  if (collapseImageBlocks !== false) {
    text = collapseImageBlocksForKb(text, maxImagesPerRun ?? 1);
  }

  return text.trim() + "\n";
}
