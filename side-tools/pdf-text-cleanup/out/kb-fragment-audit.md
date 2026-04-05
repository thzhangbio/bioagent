# KB 碎片审计

- 目录: `/Users/tianhui/Webstart/bioagent/side-tools/pdf-text-cleanup/out`
- 扫描: 短 `$…$` 内层 ≤ **160** 字符（与 `normalizeShortInlineDollarMath` 对齐时可设 `--max-inner 160`）
- 未解析: 对**孤立片段**执行 `normalizeMineruInlineLatex($…$)` 后**仍等于原文** → 需新增结构化规则（见 `mineru-kb.ts`）

| 出现次数 | 未解析片段 | 示例位置 |
| ---: | --- | --- |
| 1 | `$( 14 { - } 15 \ \mu / \mathrm { m L } .$` | 202604052255+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:168 |
| 1 | `$41 - 95 \ \mu / \mathrm { m L }$` | 202604052255+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:168 |
| 1 | `$( c . 922 A { > } G$` | 202604052255+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:184 |
| 1 | `$( \mathrm { c . 748 G { > } A }$` | 202604052255+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:190 |
| 1 | `$10 \mathrm{~min}$` | 202604052255+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:196 |
| 1 | `$510 \mathrm{~nm}$` | 202604052255+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:196 |
| 1 | `$Z _ { \mathsf { n P T O } }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:91 |
| 1 | `$Z n \mathsf { P T O } + S L C 30 A \& ^ { - \prime - }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:111 |
| 1 | `$n = 4 _ { \cdot }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:113 |
| 1 | `$\scriptstyle n = 30$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:115 |
| 1 | `$\begin{array} { r } { n = 30 } \end{array}$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:245 |
| 1 | `$n = 30 ^ { \circ } ,$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:247 |
| 1 | `$\begin{array} { r } { n = 32 } \end{array}$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:251 |
| 1 | `${ > } 22.2 \ \mathsf { m M } _ { \beta }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:291 |
| 1 | `$n = 12,$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:295 |
| 1 | `$\mathsf { Z n 2 + }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:451 |
| 1 | `$\complement a 2 +$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:519 |
| 1 | `$( 1.060 - 1.100 \pm 0.01 \ : \mathrm { g / m L) }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:663 |
| 1 | `$0.25 ~ \mathrm { \mathsf { n g / m L } }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | `$10 \mathrm { \ n g / m L }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | `$100 ~ \mathsf { n g } /$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | `$50 ~ \mathrm { { n g / m L } }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | `$( 530 \mathsf { n m } )$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:755 |
| 1 | `${ \sf M g S O _ { 4 } }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |
| 1 | `${ \mathsf { N a } } _ { 2 } { \mathsf { H P O } } _ { 4 }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |
| 1 | `${ \sf K H } _ { 2 } { \sf P O } _ { 4 }$` | 202604052256+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |

---

- 已解析片段种类数: **6**（本表不逐条列出）
- 下一步: 为「未解析」行推导规则 → 写入 `mineru-kb.ts` → 在 `fragment-fixtures.ts` 加用例 → `pnpm run pdf-kb-fragment-fixtures` → 再跑 `pdf-kb-pipeline`
