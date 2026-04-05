# 段Ⅱ：out → 知识库

根总控：
- `segment-out-to-knowledge/index.ts`

当前职责：
- 从 `out/` 收集 `*.kb.md`
- 复制到知识库目录（默认 `data/knowledge/literature-inbox/`）
- 校验 DOI / slug 等元数据
- 触发 `ingest:literature`
- 对 `rag-store.json` 做最小验证
- 在 `out/.archive-ready.json` 写入“可归档”标记，供段Ⅲ消费

默认命令：
- `pnpm run pdf-kb-out-to-knowledge`

| 子目录 | 职责（规划） |
|--------|----------------|
| `00-pre-out-check` | 入库前人工/脚本检查 |
| `01-copy-to-knowledge` | 拷贝至 knowledge 约定目录 |
| `02-metadata-id` | `paperId`、DOI、slug 对齐 |
| `03-ingest-index` | `ingest:literature` 等 |
| `04-verify-search` | 检索/分块抽样验证 |
| `05-mark-ready-archive` | 允许进入 out→archive |
