# PDF / MinerU → 知识库 Markdown（`pdf-text-cleanup`）

MinerU 导出的论文 **`.md` + 可选 `.json`** → 清洗为 **`*.kb.md`**，供拷贝至 **`data/knowledge/literature-inbox/`** 后 **`pnpm run ingest:literature`**。

**「跑一遍流水线」的约定含义**（清洗 + 碎片审计 + 助手迭代规则）见 **`WORKFLOW.md`**。仅执行下表第一行而**不**跑碎片审计、**不**根据审计更新 `mineru-kb.ts`，不等于该约定下的完整闭环。

**只迭代碎片规则、并在成稿上就地更新（不出新文件）**的步骤见 **`FRAGMENT-ASSISTANT-WORKFLOW.md`**。

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm run pdf-kb-pipeline -- --raw-md <原始.md> [--json <.json>] [--out <路径>]` | 生成 KB 终稿 |
| `pnpm run pdf-kb-fragment-list` | 列出短 `$…$` 全量清单（默认内层 ≤100 字符）→ `out/kb-fragment-list.md` |
| `pnpm run pdf-kb-fragment-audit` | 清洗**之后**扫描 `out/*.kb.md` 短 `$…$`，生成 `out/kb-fragment-audit.md`（未解析 = 待补规则） |
| `pnpm run pdf-kb-fragment-apply-inplace -- --file <成稿.kb.md>` | 对已有文件套用碎片规则；默认 dry-run，加 `--write` 写回原路径 |
| `pnpm run pdf-kb-fragment-fixtures` | 回归 `fragment-fixtures.ts` 中的碎片用例（规则改动的 CI） |
| `pnpm run pdf-cleanup -- <文件.md>` | 仅单文件清洗（见 `cli.ts`） |
| `pnpm run pdf-archive-inbox` | **①** 归档 `inbox/` 内 MinerU 源文件 → `archive/processed-mineru/` |
| `pnpm run pdf-archive-out` | **②** 归档 `out/` 内已入库的 `*.kb.md` → `archive/ingested-out/` |
| `pnpm run pdf-archive-legacy-flat` | 将 **`archive/`** 根目录旧版平铺的 MinerU `.md`/`.json` 迁入 `processed-mineru/` |

## 归档顺序（与微信侧车一致）

1. 跑 pipeline 得到 **`out/*.kb.md`** → 校对。  
2. 确认后 **`pdf-archive-inbox`**（若使用 **`inbox/`** 放 MinerU 源）。  
3. 复制 kb 至 **`data/knowledge/literature-inbox/`** → **`ingest:literature`**。  
4. 入库成功后 **`pdf-archive-out`**，腾空 **`out/`**。

详见 **`archive/README.md`**、`inbox/README.md`、`out/README.md`。
