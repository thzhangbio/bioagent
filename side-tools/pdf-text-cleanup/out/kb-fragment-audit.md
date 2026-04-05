# KB 碎片审计

- 目录: `/Users/tianhui/Webstart/bioagent/side-tools/pdf-text-cleanup/out`
- 扫描: 短 `$…$` 内层 ≤ **160** 字符（与 `normalizeShortInlineDollarMath` 对齐时可设 `--max-inner 160`）
- 未解析: 对**孤立片段**执行 `normalizeMineruInlineLatex($…$)` 后**仍等于原文** → 需新增结构化规则（见 `mineru-kb.ts`）

| 出现次数 | 未解析片段 | 示例位置 |
| ---: | --- | --- |

---

- 已解析片段种类数: **0**（本表不逐条列出）
- 下一步: 为「未解析」行推导规则 → 写入 `mineru-kb.ts` → 在 `fragment-fixtures.ts` 加用例 → `pnpm run pdf-kb-fragment-fixtures` → 再跑 `pdf-kb-pipeline`
