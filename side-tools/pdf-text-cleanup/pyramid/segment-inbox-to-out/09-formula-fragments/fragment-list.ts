/**
 * 列出目录内所有「短」`$…$` 碎片（内层长度上限可配，**默认 100**，供碎片助手流程第 1 步）。
 *
 * 与 {@link fragment-audit.ts} 的区别：本脚本列出**全部**出现过的片段及次数；审计表只强调**未解析**（规则套用后不变）的片段。
 *
 * 用法:
 *   pnpm run pdf-kb-fragment-list
 *   pnpm run pdf-kb-fragment-list -- --dir side-tools/pdf-text-cleanup/out --max-inner 100
 *   pnpm run pdf-kb-fragment-list -- --dir . --glob "*.kb.md" --out report.md
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeMineruInlineLatex } from "../segment-inbox-to-out.kb-shared.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PDF_TEXT_CLEANUP_ROOT = resolve(__dirname, "../../..");

function parseArgs(): {
  dir: string;
  maxInner: number;
  out?: string;
  globPat: string;
} {
  const argv = process.argv.slice(2);
  let dir = join(PDF_TEXT_CLEANUP_ROOT, "out");
  let maxInner = 100;
  let out: string | undefined;
  let globPat = "*.kb.md";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) dir = resolve(process.cwd(), argv[++i]);
    else if (a === "--max-inner" && argv[i + 1])
      maxInner = Math.max(1, Number.parseInt(argv[++i], 10) || maxInner);
    else if (a === "--out" && argv[i + 1]) out = resolve(process.cwd(), argv[++i]);
    else if (a === "--glob" && argv[i + 1]) globPat = argv[++i];
  }
  return { dir, maxInner, out, globPat };
}

function shortDollarRegex(maxInner: number): RegExp {
  return new RegExp(
    `(?<!\$)\\$(?!\\$)([^$\\n]{1,${maxInner}})\\$(?!\\$)`,
    "g",
  );
}

function matchGlob(filename: string, pattern: string): boolean {
  if (!pattern.includes("*")) return filename === pattern;
  const [pre, post] = pattern.split("*", 2);
  return filename.startsWith(pre) && filename.endsWith(post);
}

function main(): void {
  const { dir, maxInner, out, globPat } = parseArgs();
  const re = shortDollarRegex(maxInner);

  const files = readdirSync(dir)
    .filter((f) => matchGlob(f, globPat))
    .sort();

  type Row = {
    frag: string;
    count: number;
    innerLen: number;
    changed: boolean;
    afterPreview: string;
    examples: { file: string; line: number }[];
  };
  const byFrag = new Map<string, Row>();

  for (const file of files) {
    const path = join(dir, file);
    const text = readFileSync(path, "utf-8");
    const lines = text.split(/\n/);
    lines.forEach((line, lineIdx) => {
      const r = new RegExp(re.source, "g");
      let m: RegExpExecArray | null;
      while ((m = r.exec(line)) !== null) {
        const full = m[0];
        const inner = m[1];
        const after = normalizeMineruInlineLatex(full);
        const changed = after !== full;
        const prev = byFrag.get(full);
        if (prev) {
          prev.count += 1;
          if (prev.examples.length < 5)
            prev.examples.push({ file, line: lineIdx + 1 });
        } else {
          byFrag.set(full, {
            frag: full,
            count: 1,
            innerLen: inner.length,
            changed,
            afterPreview:
              changed && after.length <= 120
                ? after
                : changed
                  ? `${after.slice(0, 117)}…`
                  : "—",
            examples: [{ file, line: lineIdx + 1 }],
          });
        }
      }
    });
  }

  const rows = [...byFrag.values()].sort((a, b) => b.count - a.count);

  const linesOut: string[] = [
    `# KB 短公式碎片清单（全量）`,
    ``,
    `- 目录: \`${dir}\``,
    `- 匹配: \`${globPat}\``,
    `- 内层长度 ≤ **${maxInner}**（与 \`normalizeShortInlineDollarMath\` 扫描窗口一致时需把本脚本的 \`--max-inner\` 设为与 \`KB_SHORT_INLINE_MATH_MAX_INNER_LEN\` 相同）`,
    `- **已变化**：对**仅含该片段**的字符串调用 \`normalizeMineruInlineLatex\` 后 ≠ 原文 → 已有规则可改写`,
    `- **未变化**：与 \`pdf-kb-fragment-audit\` 中的「未解析」一致 → 待补结构化规则（见 \`FRAGMENT-ASSISTANT-WORKFLOW.md\`）`,
    ``,
    `- 种类数: **${rows.length}**`,
    `- 总出现次数: **${rows.reduce((s, r) => s + r.count, 0)}**`,
    `- 未解析种类: **${rows.filter((r) => !r.changed).length}**`,
    ``,
    `| 出现次数 | 内层长 | 已变化 | 片段 | 套用后（预览） | 示例位置 |`,
    `| ---: | ---: | :--- | --- | --- | --- |`,
  ];

  for (const row of rows) {
    const loc = row.examples.map((e) => `${e.file}:${e.line}`).join("<br>");
    const fragCell = row.frag.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const prevCell = row.afterPreview.replace(/\|/g, "\\|").replace(/\n/g, " ");
    linesOut.push(
      `| ${row.count} | ${row.innerLen} | ${row.changed ? "是" : "否"} | \`${fragCell}\` | ${row.changed ? `\`${prevCell}\`` : "—"} | ${loc} |`,
    );
  }

  linesOut.push(
    ``,
    `---`,
    ``,
    `下一步：按 **FRAGMENT-ASSISTANT-WORKFLOW.md** 中的步骤 2–5 迭代规则与就地更新。`,
  );

  const report = linesOut.join("\n") + "\n";
  const outPath = out ?? join(dir, "kb-fragment-list.md");
  writeFileSync(outPath, report, "utf-8");
  console.log(`已写入: ${outPath}`);
  console.log(
    `种类: ${rows.length}，总出现: ${rows.reduce((s, r) => s + r.count, 0)}，未解析种类: ${rows.filter((r) => !r.changed).length}`,
  );
}

main();
