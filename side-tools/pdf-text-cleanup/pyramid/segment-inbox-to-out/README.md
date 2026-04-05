# 段Ⅰ：inbox → out

| 子目录 | 职责（规划） |
|--------|----------------|
| `00-entry-routing` | 入口、CLI/参数、输出路径与选项 |
| `01-read-validate` | 读入 `.md`、可选校验 `.json` |
| `02-structure-json` | 从 JSON 生成结构块（若有） |
| `03-mineru-preliminary` | MinerU 初稿化 |
| `04-layout-flow` | 段落流、合并不该断行等 |
| `05-headers-footers-pages` | 重复页眉页脚、页码行等 |
| `06-tables-blocks` | 表格/特殊块处理 |
| `07-cleanup-generic` | 通用正文清洗 |
| `08-cleanup-kb-specific` | KB 专用清洗 |
| `09-formula-fragments` | 行内公式与碎片规则 |
| `10-metadata-fetch` | YAML、Crossref/Europe PMC 等 |
| `11-write-final` | 写 `out/*.kb.md` |
| `12-inbox-sync` | inbox 与归档基名对齐（更名等） |
