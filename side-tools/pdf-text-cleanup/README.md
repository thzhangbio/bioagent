# PDF / MinerU → 知识库 Markdown（`pdf-text-cleanup`）

MinerU 导出的论文 **`.md` + 可选 `.json`** → 清洗为 **`*.kb.md`**，供拷贝至 **`data/knowledge/literature-inbox/`** 后 **`pnpm run ingest:literature`**。

## 命令

| 命令 | 说明 |
|------|------|
| `pnpm run pdf-kb-pipeline -- --raw-md <原始.md> [--json <.json>] [--out <路径>]` | 生成 KB 终稿 |
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
