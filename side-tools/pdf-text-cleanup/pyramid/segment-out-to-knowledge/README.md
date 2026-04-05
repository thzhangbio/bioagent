# 段Ⅱ：out → 知识库

成品从 `out/` 进入主项目知识库（如 `data/knowledge/literature-inbox/`）及索引流程；**多数实现不在本侧车**，此处为步骤占位与检查清单。

| 子目录 | 职责（规划） |
|--------|----------------|
| `00-pre-out-check` | 入库前人工/脚本检查 |
| `01-copy-to-knowledge` | 拷贝至 knowledge 约定目录 |
| `02-metadata-id` | `paperId`、DOI、slug 对齐 |
| `03-ingest-index` | `ingest:literature` 等 |
| `04-verify-search` | 检索/分块抽样验证 |
| `05-mark-ready-archive` | 允许进入 out→archive |
