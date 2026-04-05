# 「流水线」在本侧车中的完整含义

`pdf-kb-pipeline` **只是**一段固定的清洗程序：它**不会**自行发现新碎片版式，也**不会**修改 `segment-inbox-to-out.kb-shared.ts`。  
当在协作中说 **「跑一遍流水线」** 时，约定指下面**整条闭环**（其中机器可执行部分与助手/人工部分分开）：

| 步骤 | 内容 | 谁执行 |
|------|------|--------|
| 1 | **执行清洗代码**：对 MinerU 源跑 `pnpm run pdf-kb-pipeline -- --raw-md <…> [--json <…>]` 或 `pnpm run pdf-kb-inbox-to-out -- --raw-md <…> [--json <…>]`，产出 `out/*.kb.md` | 本地命令 |
| 2 | **清洗完成后搜索短 `$…$` 碎片**：`pnpm run pdf-kb-fragment-audit`（默认扫 `out/`，生成 `out/kb-fragment-audit.md`） | 本地命令 |
| 3 | **分析未解析碎片**，把版式抽象成**通用、非硬编码**的修改思路（不绑死具体数字/基因名） | **助手 / 人工** |
| 4 | **形成规则并写入代码**：在 `pyramid/segment-inbox-to-out/segment-inbox-to-out.kb-shared.ts`（及必要时其他清洗模块）中实现 | **助手 / 人工** |
| 5 | **测试并通过**：在 `pyramid/segment-inbox-to-out/09-formula-fragments/fragment-fixtures.ts` 增加用例，`pnpm run pdf-kb-fragment-fixtures` 全绿 | **助手 / 人工** + 命令 |
| 6 | **按更新后的规则再处理正文**：再次执行步骤 1（可重复 2 核对未解析是否减少） | 本地命令 |

**要点**：

- **「流水线 + 助手」** 才能完成「发现新版式 → 规则入库 → 回归 → 再生成」；单靠重复跑 `pdf-kb-pipeline` 不会增加新规则。
- 步骤 2 的审计脚本**只读、只报告**，不会自动改稿；改稿来自步骤 1 在规则更新**之后**重跑。
- 若只跑了步骤 1、从未做 2–5，则仍属于「只跑了清洗」，不叫本文件意义上的完整「流水线闭环」。

相关文件：`pyramid/segment-inbox-to-out/segment-inbox-to-out.ts`、`pyramid/segment-inbox-to-out/09-formula-fragments/fragment-audit.ts`、`pyramid/segment-inbox-to-out/09-formula-fragments/fragment-list.ts`、`pyramid/segment-inbox-to-out/09-formula-fragments/fragment-apply-inplace.ts`、`pyramid/segment-inbox-to-out/09-formula-fragments/fragment-fixtures.ts`、`pyramid/segment-inbox-to-out/09-formula-fragments/fragment-fixtures-check.ts`、`pyramid/segment-inbox-to-out/segment-inbox-to-out.kb-shared.ts`。

新架构下的主控位置：
- 段Ⅰ：`pyramid/segment-inbox-to-out/segment-inbox-to-out.ts`
- 段Ⅱ：`pyramid/segment-out-to-knowledge/segment-out-to-knowledge.ts`
- 段Ⅲ：`pyramid/segment-out-to-archive/segment-out-to-archive.ts`

碎片相关的横切工具已并入 `pyramid/segment-inbox-to-out/09-formula-fragments/`：
- `fragment-audit.ts`
- `fragment-list.ts`
- `fragment-apply-inplace.ts`
- `fragment-fixtures.ts`
- `fragment-fixtures-check.ts`

**仅碎片、就地更新成稿（不出新文件）**的助手步骤见 **`FRAGMENT-ASSISTANT-WORKFLOW.md`**。
