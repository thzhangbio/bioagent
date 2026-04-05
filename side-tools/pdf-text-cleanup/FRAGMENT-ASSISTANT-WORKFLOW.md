# 碎片处理助手流程（与「整篇 pipeline 出新文件」分离）

目标：在**不跑** `pdf-kb-pipeline` 出新稿的前提下，专门迭代 **短 `$…$` 行内碎片**的规则，并在确认后**直接写回同一 Markdown 文件**。

与 **`WORKFLOW.md`** 的关系：`WORKFLOW.md` 描述「MinerU → 清洗 → 审计 → 补规则 → 再 pipeline」的**整篇闭环**；本文件描述**只动碎片规则、就地更新成稿**的侧向流程。规则代码仍落在同一处：**`mineru-kb.ts`**（见下「规则入库」）。

---

## 1️⃣ 找出所有「内层 ≤100 字符」的 `$…$` 碎片

使用清单脚本（默认扫描 `out/`、内层 **≤100** 字符，与 `KB_SHORT_INLINE_MATH_MAX_INNER_LEN` 无关，便于助手先收敛短碎片）：

```bash
pnpm run pdf-kb-fragment-list -- --dir side-tools/pdf-text-cleanup/out --max-inner 100
```

产出：`out/kb-fragment-list.md`（若未传 `--out`）。

表中包含：**出现次数、内层长度、是否已被现有规则改写（「已变化」列）、套用后预览、示例位置**。  
「已变化 = 否」与 `pdf-kb-fragment-audit` 的「未解析」一致，是补规则时的优先队列。

若要与清洗链路的短公式窗口**完全对齐**，将 `--max-inner` 设为与 `KB_SHORT_INLINE_MATH_MAX_INNER_LEN`（当前 **160**）相同即可。

---

## 2️⃣ 分析处理方式，以非硬编码形式写更新规则

- **不要**为审计表里的每一行单独 `if (s === '某基因某数字')`。
- **要**抽象版式：用正则**捕获组**、折叠 OCR 空格（`collapseSpacedChars` 等已有工具）、长度/字符类约束，使**一类** PDF 版式共用一条规则。
- **落点**：在 **`mineru-kb.ts`** 中扩展 `tryParenAndStatFragmentsToPlain`、`normalizeShortInlineDollarMath` 或 `normalizeMineruInlineLatex` 内与行内 `$…$` 相关的替换（与现有代码风格一致）。

---

## 3️⃣ 测试更新规则是否生效

在 **`fragment-fixtures.ts`** 中为新版式增加 `input`（完整短 `$…$`）与 `expected`（`normalizeMineruInlineLatex` 期望输出），然后：

```bash
pnpm run pdf-kb-fragment-fixtures
```

通过后再做第 4 步，避免误伤正文。

---

## 4️⃣ 将规则「入库」为碎片更新规则

本仓库的**唯一事实来源**仍是 **`mineru-kb.ts`**（外加 `fragment-fixtures.ts` 的回归用例）。  
对外说明可写：碎片规则由 **`applyKbFragmentRulesToMarkdown`**（实现上等同于对全文调用 **`normalizeMineruInlineLatex`**）统一套用。

**未命中即保留**：短 `$…$` 在 **`tryParenAndStatFragmentsToPlain`** 与 **`tryShortInlineMathToPlainUnicode`** 均未命中时**不**做猜测性剥壳，仍输出 **`$…$`**；`pdf-kb-fragment-audit` 会将此类记为未解析，直至在 `mineru-kb.ts` 中增加显式规则并通过夹具验证。

---

## 5️⃣ 按规则在文内定位更新，不产生新文件

对已存在的 `.kb.md`（或其它 Markdown）**只套用碎片规则**，默认 **dry-run**；确认后加 **`--write`** 写回**同一路径**（不生成 `out/新文件名`）：

```bash
# 先看摘要，不写盘
pnpm run pdf-kb-fragment-apply-inplace -- --file path/to/article.kb.md

# 确认后写回
pnpm run pdf-kb-fragment-apply-inplace -- --file path/to/article.kb.md --write

# 或整目录
pnpm run pdf-kb-fragment-apply-inplace -- --dir side-tools/pdf-text-cleanup/out --write
```

**说明**：此步骤**只**执行 `applyKbFragmentRulesToMarkdown`（即 `normalizeMineruInlineLatex`），不包含 `cleanMarkdownForKnowledgeBase` 里的表格展平、图片折叠、`cleanPdfTextMd` 等整篇清洗。若需要与 pipeline 完全一致，应仍使用 `pdf-kb-pipeline` 从 MinerU 源重跑。

---

## 命令对照

| 命令 | 作用 |
|------|------|
| `pnpm run pdf-kb-fragment-list` | 第 1 步：列出短 `$…$` 全量清单 |
| `pnpm run pdf-kb-fragment-audit` | 仅未解析碎片表（与历史脚本一致） |
| `pnpm run pdf-kb-fragment-fixtures` | 第 3 步：回归测试 |
| `pnpm run pdf-kb-fragment-apply-inplace` | 第 5 步：就地套用规则 |
