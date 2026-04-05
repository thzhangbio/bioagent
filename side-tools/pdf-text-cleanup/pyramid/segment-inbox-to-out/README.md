# 段Ⅰ：inbox → out

根总控：
- `segment-inbox-to-out/segment-inbox-to-out.ts`

当前职责：
- 解析段Ⅰ命令入口参数
- 读入 MinerU `.md` / 可选 `.json`
- 生成结构块与初步稿
- 依次完成版面流、页眉页脚、表格块、通用清洗、KB 专用清洗、公式碎片清洗
- 追加 KB metadata
- 写出 `out/*.kb.md`
- 在需要时对齐 inbox 源文件命名

与本段直接相关的横切工具：
- `09-formula-fragments/fragment-audit.ts`
- `09-formula-fragments/fragment-list.ts`
- `09-formula-fragments/fragment-apply-inplace.ts`
- `09-formula-fragments/fragment-fixtures.ts`
- `09-formula-fragments/fragment-fixtures-check.ts`

这些工具仍位于侧车根目录，但它们服务的核心规则层就是本段的 `09-formula-fragments`。

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
