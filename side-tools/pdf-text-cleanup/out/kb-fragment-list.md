# KB 短公式碎片清单（全量）

- 目录: `/Users/tianhui/Webstart/bioagent/side-tools/pdf-text-cleanup/out`
- 匹配: `*.kb.md`
- 内层长度 ≤ **100**（与 `normalizeShortInlineDollarMath` 扫描窗口一致时需把本脚本的 `--max-inner` 设为与 `KB_SHORT_INLINE_MATH_MAX_INNER_LEN` 相同）
- **已变化**：对**仅含该片段**的字符串调用 `normalizeMineruInlineLatex` 后 ≠ 原文 → 已有规则可改写
- **未变化**：与 `pdf-kb-fragment-audit` 中的「未解析」一致 → 待补结构化规则（见 `FRAGMENT-ASSISTANT-WORKFLOW.md`）

- 种类数: **91**
- 总出现次数: **99**
- 未解析种类: **91**

| 出现次数 | 内层长 | 已变化 | 片段 | 套用后（预览） | 示例位置 |
| ---: | ---: | :--- | --- | --- | --- |
| 4 | 30 | 否 | `$50 ~ \mu \ g / \mathrm { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 2 | 17 | 否 | `$\cdot D A ^ { + }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:91<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:105 |
| 2 | 35 | 否 | `${ \sf H } _ { 2 } { \sf O } _ { 2 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:107<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:215 |
| 2 | 14 | 否 | `$1 \% 0 _ { 2 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:179<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:191 |
| 2 | 18 | 否 | `$( 1 \% 0 _ { 2 } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:209<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:805 |
| 2 | 22 | 否 | `$3.34 ~ \mathsf { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:687<br>202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:687 |
| 1 | 33 | 否 | `$ { \mathrm { I I b } } ^ { 2, 3 }$` | — | 202604052225+evidence-of-monkeypox-virus-clade-iib-lineage-a-2-2-in-t+10.1038_s41591-026-04256-2.kb.md:18 |
| 1 | 15 | 否 | `$2022 ^ { 8, 9 }$` | — | 202604052225+evidence-of-monkeypox-virus-clade-iib-lineage-a-2-2-in-t+10.1038_s41591-026-04256-2.kb.md:26 |
| 1 | 13 | 否 | `$2022 ^ { 22 }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:130 |
| 1 | 23 | 否 | `$250 ~ \mathrm { \ n g }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:134 |
| 1 | 21 | 否 | `$\mu \mathrm { B C A }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:142 |
| 1 | 39 | 否 | `$( 14 { - } 15 \ \mu / \mathrm { m L } .$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:168 |
| 1 | 31 | 否 | `$41 - 95 \ \mu / \mathrm { m L }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:168 |
| 1 | 15 | 否 | `$70 { - } 130 \%$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:168 |
| 1 | 26 | 否 | `$c . 3019 G \mathrm { > A }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:178 |
| 1 | 34 | 否 | `${ \mathrm { c . 1303 C { > } T } }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:178 |
| 1 | 19 | 否 | `$( c . 922 A { > } G$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:184 |
| 1 | 31 | 否 | `$( \mathrm { c . 748 G { > } A }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:190 |
| 1 | 26 | 否 | `$\mathrm { S L E ^ { 48 } }$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:190 |
| 1 | 18 | 否 | `$3548 ~ \mu g / L ;$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:218 |
| 1 | 33 | 否 | `$\mathbf { \sigma } \cdot \kappa B$` | — | 202604052225+exome-sequencing-enables-molecular-diagnosis-in-10-of-ea+10.1016_j.ebiom.2026.106209.kb.md:240 |
| 1 | 28 | 否 | `$1^{*}10^{13}\mathrm{Vg / ml}$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:184 |
| 1 | 16 | 否 | `$10 \mathrm{~min}$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:196 |
| 1 | 16 | 否 | `$510 \mathrm{~nm}$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:196 |
| 1 | 13 | 否 | `$1 \mathrm{~h}$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:210 |
| 1 | 33 | 否 | `$\left\|\mathrm{FC}\right\| \geq 1.5$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:218 |
| 1 | 6 | 否 | `$0.125M$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:222 |
| 1 | 2 | 否 | `$1g$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:224 |
| 1 | 4 | 否 | `$1.5x$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:436 |
| 1 | 20 | 否 | `$\|\mathrm{FC}\| \geq 2$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:440 |
| 1 | 19 | 否 | `$(1\mathrm{mg / kg})$` | — | 202604052226+inhibition-of-adipocyte-runx1-2-enhances-adipose-tissue-+10.1038_s41467-026-71266-6.kb.md:444 |
| 1 | 34 | 否 | `$11 S ^ { + } \mathrm { ~ \beta ~ }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:91 |
| 1 | 59 | 否 | `$\mathsf { G C G } ^ { + } \mathrm { ~ \pmb ~ { \alpha } ~ }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:91 |
| 1 | 27 | 否 | `$Z _ { \mathsf { n P T O } }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:91 |
| 1 | 58 | 否 | `$W { \sf S } ^ { + } N { \sf K } \times 6.1 ^ { + } \ \beta$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:103 |
| 1 | 15 | 否 | `$^ { + } NKX6.1+$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:103 |
| 1 | 54 | 否 | `$Z n \mathsf { P T O } + S L C 30 A \& ^ { - \prime - }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:111 |
| 1 | 17 | 否 | `$n = 4 _ { \cdot }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:113 |
| 1 | 19 | 否 | `$\scriptstyle n = 30$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:115 |
| 1 | 10 | 否 | `$( 2 \mu M)$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:117 |
| 1 | 47 | 否 | `$W { \sf S } ^ { + } \sf N K X 6.1 ^ { + } \beta$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:151 |
| 1 | 25 | 否 | `$( I N S ^ { w / G F P } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:151 |
| 1 | 23 | 否 | `$S O D 2 ^ { 63 - 68 } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 19 | 否 | `$B S G ^ { 69 - 71 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 29 | 否 | `$B N I P 3 ^ { 64, 72 - 74 } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 24 | 否 | `$M T - N D 4 ^ { 75, 76 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 10 | 否 | `$50 \mu m ;$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 44 | 否 | `$S L C 30 A 8 ^ { - / - } \mathsf { A D - } \|$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:153 |
| 1 | 12 | 否 | `$( 3 ~ \mu M)$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:197 |
| 1 | 23 | 否 | `$I N S ^ { G F P / W } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:205 |
| 1 | 22 | 否 | `$> 22.2 \mathsf { m M }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:239 |
| 1 | 42 | 否 | `$\begin{array} { r } { n = 30 } \end{array}$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:245 |
| 1 | 20 | 否 | `$n = 30 ^ { \circ } ,$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:247 |
| 1 | 42 | 否 | `$\begin{array} { r } { n = 32 } \end{array}$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:251 |
| 1 | 40 | 否 | `${ > } 22.2 \ \mathsf { m M } _ { \beta }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:291 |
| 1 | 20 | 否 | `$7, 10, 110 { - } 119$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:291 |
| 1 | 7 | 否 | `$n = 12,$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:295 |
| 1 | 22 | 否 | `$( \boldsymbol { \\| } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:295 |
| 1 | 19 | 否 | `$\mathsf { Z n 2 + }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:451 |
| 1 | 41 | 否 | `${ \sf O } 2 ( - \mathrm { ^ { \star } } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:483 |
| 1 | 17 | 否 | `$\complement a 2 +$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:519 |
| 1 | 22 | 否 | `$22 \pm 1 ^ { \circ } C$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:655 |
| 1 | 14 | 否 | `$40 { - } 60 \%$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:655 |
| 1 | 25 | 否 | `$1 \mathsf { c m } ^ { 3 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:663 |
| 1 | 49 | 否 | `$( 1.060 - 1.100 \pm 0.01 \ : \mathrm { g / m L) }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:663 |
| 1 | 21 | 否 | `$425 ~ \mathsf { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:677 |
| 1 | 10 | 否 | `$( 1 \mu g)$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:681 |
| 1 | 27 | 否 | `$100 \ \mathrm { n g / m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | 40 | 否 | `$0.25 ~ \mathrm { \mathsf { n g / m L } }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | 26 | 否 | `$10 \mathrm { \ n g / m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | 23 | 否 | `$100 ~ \mathsf { n g } /$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:685 |
| 1 | 10 | 否 | `${ 20 ~ 9 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 20 | 否 | `$45 ~ \mathsf { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 15 | 否 | `$100 ~ \mu \iota$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 15 | 否 | `$Z n S O _ { 4 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 12 | 否 | `$10 ~ \mu \ M$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 22 | 否 | `$8.33 \ \mathrm { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 19 | 否 | `$6 \mathrm { \ m l }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 19 | 否 | `$5 ~ \mathsf { m L }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 30 | 否 | `$50 ~ \mathrm { { n g / m L } }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 10 | 否 | `$10 \mu \ M$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:689 |
| 1 | 1 | 否 | `$p$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:707 |
| 1 | 23 | 否 | `$( 530 \mathsf { n m } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:755 |
| 1 | 23 | 否 | `${ \sf M g S O _ { 4 } }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |
| 1 | 57 | 否 | `${ \mathsf { N a } } _ { 2 } { \mathsf { H P O } } _ { 4 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |
| 1 | 39 | 否 | `${ \sf K H } _ { 2 } { \sf P O } _ { 4 }$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:777 |
| 1 | 13 | 否 | `$100 ~ \mu \ L$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:809 |
| 1 | 13 | 否 | `$400 ~ \mu \ L$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:819 |
| 1 | 12 | 否 | `$40 ~ \mu \ L$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:819 |
| 1 | 27 | 否 | `$( 1 ~ \mu \mathfrak { g } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:831 |
| 1 | 32 | 否 | `$K ( 20 \mu g / \mathsf { m L } )$` | — | 202604052226+pre-adaptation-of-stem-cell-derived-islet-organoids-to-h+10.1016_j.stem.2026.03.004.kb.md:835 |

---

下一步：按 **FRAGMENT-ASSISTANT-WORKFLOW.md** 中的步骤 2–5 迭代规则与就地更新。
