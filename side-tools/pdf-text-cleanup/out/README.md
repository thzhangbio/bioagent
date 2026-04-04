# out — 知识库终稿 `*.kb.md`

由 **`pnpm run pdf-kb-pipeline`**（或 `cli.ts`）生成；再复制至 **`data/knowledge/literature-inbox/`** 执行 **`pnpm run ingest:literature`**。

**归档 ②**：**文献向量入库成功后**，执行 **`pnpm run pdf-archive-out`**，将本目录 `*.kb.md` 移至 **`archive/ingested-out/<时间戳>/`**，腾空 out。
