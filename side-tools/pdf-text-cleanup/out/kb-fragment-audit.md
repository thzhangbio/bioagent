# KB 碎片审计

- 目录: `/Users/tianhui/Webstart/bioagent/side-tools/pdf-text-cleanup/out`
- 扫描: 短 `$…$` 内层 ≤ **160** 字符（与 `normalizeShortInlineDollarMath` 对齐时可设 `--max-inner 160`）
- 未解析: 对**孤立片段**执行 `normalizeMineruInlineLatex($…$)` 后**仍等于原文** → 需新增结构化规则（见 `mineru-kb.ts`）

| 出现次数 | 未解析片段 | 示例位置 |
| ---: | --- | --- |
| 2 | `$\varnothing 0 ^ { \circ } C$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:732<br>202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:845 |
| 1 | `$T =$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:84 |
| 1 | `$N = 3 { - } 5$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:88 |
| 1 | `$\zeta n = 8$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:92 |
| 1 | `$T _ { H } \mathsf { 1 }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:134 |
| 1 | `${ T } _ { H } { \mathsf { 1 } }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:168 |
| 1 | `$100 ~ { \mu m } )$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:206 |
| 1 | `$h = \#$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:220 |
| 1 | `${ T } { L } { S } ^ { 13 }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:252 |
| 1 | `$\cdot \kappa B \mathsf { 2 }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:426 |
| 1 | `$\sim 1.8 m$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:655 |
| 1 | `$( 50 \mu \ g / m μ$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:655 |
| 1 | `$( 5 ~ \mu \varrho / m \|$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:655 |
| 1 | `$( 1 \ \mu g / m l$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:655 |
| 1 | `$0.3 g / \mathsf { k g }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:661 |
| 1 | `$15 m \|$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:665 |
| 1 | `$+ 50 U / m l$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:665 |
| 1 | `$( 5 ~ \mu \varrho / m \mu$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:736 |
| 1 | `$250 U / m \|$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:736 |
| 1 | `$< 10, 000 \mu m ^ { 2 } )$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:756 |
| 1 | `$10, 000 { - } 25, 000 \ \mu m ^ { 2 } )$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:756 |
| 1 | `$> 25, 000 \mu m ^ { 2 } )$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:756 |
| 1 | `$> 2, 500 \mu m ^ { 2 }$` | 202604061516+myofibroblast-programming-blocks-differentiation-of-tls-+10.1016_j.ccell.2026.03.004.kb.md:756 |
| 1 | `${ A } – 485 ^ { 44 }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:120 |
| 1 | `$I { \cal { I } } _ { } ^ { } - { \bf \nabla } ^ { / - }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:124 |
| 1 | `$^ { \mathfrak { g t } } / J$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:725 |
| 1 | `$( \mathsf { C 57 B L } / 6 \mathrm { - } \mathsf { P r f 1 } ^ { \mathrm { t m 15 d z } } / J)$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:725 |
| 1 | `$50 m M$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:741 |
| 1 | `$\textstyle - 80 ^ { \circ } C$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:741 |
| 1 | `${ 72 ^ { \circ } } C$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:761 |
| 1 | `$\%$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:761 |
| 1 | `$\scriptstyle \mathsf { m C } = 100 / ( 1 + E) ^ { \mathsf { C q 2 } - \mathsf { C q 1 } }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:761 |
| 1 | `$N _ { 2 }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:779 |
| 1 | `$[ { 99 } m _ { \mathsf { T C } } ] \mathsf { N a } \mathsf { T c } O _ { 4 }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:779 |
| 1 | `$P ^ { \mathsf { 99 m } } \mathsf { T c } J \mathsf { N a T c O } _ { 4 }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:779 |
| 1 | `$V = ( 4 / 3) \times \pi \times ( W / 2) ^ { 2 } \times ( L / 2)$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:783 |
| 1 | `$100 \mu \rho B S$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:783 |
| 1 | `$( \mathsf { p h } / s / \mathsf { c m } ^ { 2 } / \mathsf { s r }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:799 |
| 1 | `$2 ^ { - \Delta C t }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:801 |
| 1 | `$110 ~ \mu L / 11, 8 { \pm } 0, 8 ~ N$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:803 |
| 1 | `$( 40 \mu L / 3, 5 { \pm } 0, 3$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:803 |
| 1 | `$( 2 \%$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:803 |
| 1 | `$15 ^ { \circ } C)$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:821 |
| 1 | `$37 ^ { \circ } C)$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:821 |
| 1 | `$1.9 \ \mu m$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:825 |
| 1 | `$900 ~ m / z$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:825 |
| 1 | `$_ { P < 0.05) }$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:829 |
| 1 | `${ p } { < } 0.05$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:829 |
| 1 | `$( n { = } 7, 635)$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:841 |
| 1 | `$4 ^ { \circ } C.$` | 202604061516+radiotherapy-synergizes-with-an-inducible-aav-based-immu+10.1016_j.ccell.2026.02.013.kb.md:845 |

---

- 已解析片段种类数: **0**（本表不逐条列出）
- 下一步: 为「未解析」行推导规则 → 写入 `mineru-kb.ts` → 在 `fragment-fixtures.ts` 加用例 → `pnpm run pdf-kb-fragment-fixtures` → 再跑 `pdf-kb-pipeline`
