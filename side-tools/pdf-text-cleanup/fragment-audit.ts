/**
 * KB 短 `$…$` 碎片审计（**不是**再跑一遍现有规则）。
 * 完整「流水线」人机约定见同目录 **`WORKFLOW.md`**。
 *
 * 闭环意图：
 * 1. **搜到**成对短 `$…$`（与 {@link normalizeShortInlineDollarMath} 同一长度上限，默认 {@link KB_SHORT_INLINE_MATH_MAX_INNER_LEN}）；
 * 2. 对每个**孤立**片段调用 {@link normalizeMineruInlineLatex}；
 * 3. 若输出与输入相同 → **未解析**，作为「需新规则」候选（由人工/助手推导**不硬编码**的结构化规则，写入 `mineru-kb.ts`）；
 * 4. 在 {@link fragment-fixtures.ts} 添加 `input`/`expected`，用 `pnpm run pdf-kb-fragment-fixtures` 验证后再跑 `pdf-kb-pipeline`。
 *
 * 用法:
 *   pnpm run pdf-kb-fragment-audit
 *   pnpm run pdf-kb-fragment-audit -- --dir side-tools/pdf-text-cleanup/out
 *   pnpm run pdf-kb-fragment-audit -- --max-inner 100
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KB_SHORT_INLINE_MATH_MAX_INNER_LEN,
  normalizeMineruInlineLatex,
} from "./mineru-kb.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function parseArgs(): { dir: string; maxInner: number; out?: string } {
  const argv = process.argv.slice(2);
  let dir = join(__dirname, "out");
  let maxInner = KB_SHORT_INLINE_MATH_MAX_INNER_LEN;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) dir = resolve(process.cwd(), argv[++i]);
    else if (a === "--max-inner" && argv[i + 1])
      maxInner = Math.max(1, Number.parseInt(argv[++i], 10) || maxInner);
    else if (a === "--out" && argv[i + 1]) out = resolve(process.cwd(), argv[++i]);
  }
  return { dir, maxInner, out };
}

function shortDollarRegex(maxInner: number): RegExp {
  return new RegExp(
    `(?<!\$)\\$(?!\\$)([^$\\n]{1,${maxInner}})\\$(?!\\$)`,
    "g",
  );
}

function main(): void {
  const { dir, maxInner, out } = parseArgs();
  const re = shortDollarRegex(maxInner);

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".kb.md"))
    .sort();

  type Agg = { count: number; examples: { file: string; line: number }[] };
  const unresolved = new Map<string, Agg>();
  const resolved = new Map<string, number>();

  for (const file of files) {
    const path = join(dir, file);
    const text = readFileSync(path, "utf-8");
    const lines = text.split(/\n/);
    lines.forEach((line, lineIdx) => {
      const r = new RegExp(re.source, "g");
      let m: RegExpExecArray | null;
      while ((m = r.exec(line)) !== null) {
        const full = m[0];
        const after = normalizeMineruInlineLatex(full);
        if (after === full) {
          const prev = unresolved.get(full) ?? { count: 0, examples: [] };
          prev.count += 1;
          if (prev.examples.length < 5)
            prev.examples.push({ file, line: lineIdx + 1 });
          unresolved.set(full, prev);
        } else {
          resolved.set(full, (resolved.get(full) ?? 0) + 1);
        }
      }
    });
  }

  const unresolvedRows = [...unresolved.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([frag, agg]) => ({
      frag,
      count: agg.count,
      examples: agg.examples,
    }));

  const linesOut: string[] = [
    `# KB 碎片审计`,
    ``,
    `- 目录: \`${dir}\``,
    `- 扫描: 短 \`$…$\` 内层 ≤ **${maxInner}** 字符（与 \`normalizeShortInlineDollarMath\` 对齐时可设 \`--max-inner ${KB_SHORT_INLINE_MATH_MAX_INNER_LEN}\`）`,
    `- 未解析: 对**孤立片段**执行 \`normalizeMineruInlineLatex($…$)\` 后**仍等于原文** → 需新增结构化规则（见 \`mineru-kb.ts\`）`,
    ``,
    `| 出现次数 | 未解析片段 | 示例位置 |`,
    `| ---: | --- | --- |`,
  ];

  for (const row of unresolvedRows) {
    const loc = row.examples.map((e) => `${e.file}:${e.line}`).join("<br>");
    const cell = row.frag.replace(/\|/g, "\\|").replace(/`/g, "\\`");
    linesOut.push(`| ${row.count} | \`${cell}\` | ${loc} |`);
  }

  linesOut.push(
    ``,
    `---`,
    ``,
    `- 已解析片段种类数: **${resolved.size}**（本表不逐条列出）`,
    `- 下一步: 为「未解析」行推导规则 → 写入 \`mineru-kb.ts\` → 在 \`fragment-fixtures.ts\` 加用例 → \`pnpm run pdf-kb-fragment-fixtures\` → 再跑 \`pdf-kb-pipeline\``,
  );

  const report = linesOut.join("\n") + "\n";
  const outPath = out ?? join(dir, "kb-fragment-audit.md");
  writeFileSync(outPath, report, "utf-8");
  console.log(`已写入: ${outPath}`);
  console.log(
    `未解析种类: ${unresolvedRows.length}，未解析总出现: ${unresolvedRows.reduce((s, r) => s + r.count, 0)}`,
  );
}

main();
