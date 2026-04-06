# PDF / MinerU → 知识库 Markdown（`pdf-text-cleanup`）

MinerU 导出的论文 **`.md` + 可选 `.json`** → 清洗为 **`*.kb.md`**，供拷贝至 **`data/knowledge/literature-inbox/`** 后 **`pnpm run ingest:literature`**。

当前主实现已迁入 **`pyramid/`**：
- 段Ⅰ：`pyramid/segment-inbox-to-out/`
- 段Ⅱ：`pyramid/segment-out-to-knowledge/`
- 段Ⅲ：`pyramid/segment-out-to-archive/`

当前命令入口已经直接切到 `pyramid`，不再依赖侧车根目录旧脚本。

**「跑一遍流水线」的约定含义**（清洗 + 碎片审计 + 助手迭代规则）见 **`WORKFLOW.md`**。仅执行下表第一行而**不**跑碎片审计、**不**根据审计更新 `segment-inbox-to-out.kb-shared.ts`，不等于该约定下的完整闭环。

**只迭代碎片规则、并在成稿上就地更新（不出新文件）**的步骤见 **`FRAGMENT-ASSISTANT-WORKFLOW.md`**。

**流水线金字塔（inbox → out → archive 与各子步骤占位目录）**见 **`pyramid/README.md`**。

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm run pdf-kb-pipeline -- --raw-md <原始.md> [--json <.json>] [--out <路径>]` | 生成 KB 终稿 |
| `pnpm run pdf-kb-inbox-to-out -- --raw-md <原始.md> [--json <.json>] [--out <路径>]` | 直接运行段Ⅰ总控 |
| `pnpm run pdf-kb-out-to-knowledge [-- --out-dir <路径> --knowledge-dir <路径>]` | 运行段Ⅱ：copy → ingest → verify → 标记可归档（当前文献默认按 `sourceId` 增量 upsert） |
| `pnpm run pdf-kb-archive` | 归档 **当前** `out/*.kb.md` 与 `inbox/*.md/.json`；这是“把 `pdf-text-cleanup` 当前文件归档”的推荐固定命令 |
| `pnpm run pdf-kb-out-to-archive [-- --mode all\|out-only\|inbox-only]` | 运行段Ⅲ：归档 out / inbox 并写审计日志 |
| `pnpm run pdf-kb-fragment-list` | 列出短 `$…$` 全量清单（默认内层 ≤100 字符）→ `out/kb-fragment-list.md` |
| `pnpm run pdf-kb-fragment-audit` | 清洗**之后**扫描 `out/*.kb.md` 短 `$…$`，生成 `out/kb-fragment-audit.md`（未解析 = 待补规则） |
| `pnpm run pdf-kb-fragment-apply-inplace -- --file <成稿.kb.md>` | 对已有文件套用碎片规则；默认 dry-run，加 `--write` 写回原路径 |
| `pnpm run pdf-kb-fragment-fixtures` | 回归 `pyramid/segment-inbox-to-out/09-formula-fragments/fragment-fixtures.ts` 中的碎片用例 |
| `pnpm run pdf-cleanup -- <文件.md>` | 仅单文件清洗（见 `pyramid/tools/pdf-cleanup/pdf-cleanup.ts`） |
| `pnpm run pdf-archive-inbox` | **①** 只归档 `inbox/` 内 MinerU 源文件 → `archive/processed-mineru/` |
| `pnpm run pdf-archive-out` | **②** 只归档 `out/` 内已入库的 `*.kb.md` → `archive/ingested-out/` |
| `pnpm run pdf-archive-legacy-flat` | 将 **`archive/`** 根目录旧版平铺的 MinerU `.md`/`.json` 迁入 `processed-mineru/` |

## 归档的准确定义

在这个工具里，“归档”不是“做个备份”或者“复制一份”，而是下面这组**固定搬运动作**：

1. 把 **当前** `side-tools/pdf-text-cleanup/out/` 里的所有 `*.kb.md` 文件移动到  
   `side-tools/pdf-text-cleanup/archive/ingested-out/<时间戳>/`
2. 把 **当前** `side-tools/pdf-text-cleanup/inbox/` 里的所有 `.md` 和 `.json` 源文件（`README.md` 除外）移动到  
   `side-tools/pdf-text-cleanup/archive/processed-mineru/<时间戳>/`
3. 在 `side-tools/pdf-text-cleanup/archive/audit-log/<时间戳>.json` 写一份审计日志
4. 如果存在 `side-tools/pdf-text-cleanup/out/.archive-ready.json`，归档成功后删除它

**不会被移动的内容**：

- `out/README.md`
- `out/kb-fragment-audit.md`
- `out/kb-fragment-list.md`
- `out/short-inline-math-inventory-*.md`
- `inbox/README.md`
- 任何不在上面规则内的文件

## 什么时候可以归档

只有在下面 3 件事都成立时，才应该运行归档：

1. `out/*.kb.md` 已经是终稿
2. 这些终稿已经完成入库
3. 你不准备继续在 `out/` 或 `inbox/` 里编辑这批文件

如果用户的自然语言指令是：

- “把 `pdf-text-cleanup` 当前内容归档”
- “把这个文件夹里现在这些 PDF 清洗文件归档”
- “清空 `out` 和 `inbox`，把它们归到 archive”

那默认就执行：

```bash
pnpm run pdf-kb-archive
```

这条命令就是“归档当前内容”的固定脚本入口，不需要模型再判断 `manifest`、`mode` 或子阶段细节。

## 归档顺序（正常主线）

1. 跑 pipeline 得到 **`out/*.kb.md`** → 校对。  
2. 跑入库，确保这批终稿已经进入知识库。  
3. 确认后执行 **`pnpm run pdf-kb-archive`**。  
4. 归档脚本会一次性处理 `out/` 和 `inbox/`，并写审计日志。

在新架构下，也可直接使用：
- `pdf-kb-inbox-to-out`
- `pdf-kb-out-to-knowledge`
- `pdf-kb-archive`
- `pdf-kb-out-to-archive`

详见 **`archive/README.md`**、`inbox/README.md`、`out/README.md`。
