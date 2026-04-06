# 段Ⅰ：inbox → out

本目录负责将 MinerU 原始稿清洗成适合进入知识库的 `out/*.kb.md`。

## 根目录代码文件

| 文件 | 作用 |
| --- | --- |
| `segment-inbox-to-out.ts` | 段Ⅰ总控。负责串联 `00` 到 `12` 各阶段，并维护共享上下文。 |
| `stage-shared.ts` | 段Ⅰ阶段名、上下文结构、完成标记与笔记追加等共享类型。 |
| `segment-inbox-to-out.archive-name-shared.ts` | 归档基名、DOI 段、slug、时间戳相关共享逻辑。 |
| `segment-inbox-to-out.cleanup-shared.ts` | 非 KB 语义的正文清洗共享逻辑，如页眉页脚、段落流、HTML 残留、publisher boilerplate。 |
| `segment-inbox-to-out.kb-shared.ts` | KB 专用正文清洗与公式碎片规则主库。 |
| `segment-inbox-to-out.metadata-shared.ts` | YAML metadata 提取、Crossref / Europe PMC 抓取与归一化。 |

## 根目录文档

| 文件 | 作用 |
| --- | --- |
| `README.md` | 段Ⅰ总览，说明根目录共享文件与一级子目录职责。 |
| `CLEANUP-HANDBOOK.md` | 非公式类清洗经验手册，沉淀 HTML 残留、页脚、boilerplate 等规则经验。 |
| `QUALITY-STANDARD.md` | 判定 `out/*.kb.md` 是否达到高质量向量化原材料标准的验收说明。 |

## 一级子目录

| 子目录 | 根文件 | 作用 |
| --- | --- | --- |
| `00-entry-routing/` | `00-entry-routing.ts` | 入口、CLI 参数、输出路径和运行选项解析。 |
| `01-read-validate/` | `01-read-validate.ts` | 读取原始 `.md` / 可选 `.json`，完成最基本输入校验。 |
| `02-structure-json/` | `02-structure-json.ts` | 调度结构 JSON 处理。 |
| `02-structure-json/` | `mineru-json-structure.ts` | 从 MinerU JSON 生成版面顺序结构摘要文本。 |
| `03-mineru-preliminary/` | `03-mineru-preliminary.ts` | 初稿化阶段入口。 |
| `03-mineru-preliminary/` | `mineru-raw-to-preliminary.ts` | 将 MinerU 原始导出转为初步稿，处理图片占位、HTML 标签、标题保留等。 |
| `04-layout-flow/` | `04-layout-flow.ts` | 段落流、断词合并、硬换行续句修复。 |
| `05-headers-footers-pages/` | `05-headers-footers-pages.ts` | 页眉页脚、页码、期刊重复行等整行噪声处理。 |
| `06-tables-blocks/` | `06-tables-blocks.ts` | 表格块与特殊块位置保留，目前为独立占位节点。 |
| `07-cleanup-generic/` | `07-cleanup-generic.ts` | 通用正文清洗阶段入口。 |
| `07-cleanup-generic/` | `cleanup-apply-inplace.ts` | 对已有 `*.kb.md` 做非公式类就地清洗，默认 dry-run。 |
| `08-cleanup-kb-specific/` | `08-cleanup-kb-specific.ts` | KB 专用清洗阶段入口。 |
| `09-formula-fragments/` | `09-formula-fragments.ts` | 公式碎片规则阶段入口。 |
| `09-formula-fragments/` | `fragment-audit.ts` | 审计未解析 `$...$` 碎片。 |
| `09-formula-fragments/` | `fragment-audit-shared.ts` | 碎片审计与质量门共用的未解析片段扫描逻辑。 |
| `09-formula-fragments/` | `fragment-list.ts` | 列出碎片出现频次，辅助归类。 |
| `09-formula-fragments/` | `fragment-apply-inplace.ts` | 对已有 `*.kb.md` 套用公式碎片规则。 |
| `09-formula-fragments/` | `fragment-fixtures.ts` | 疑难碎片案例夹具。 |
| `09-formula-fragments/` | `fragment-fixtures-check.ts` | 跑碎片夹具回归检查。 |
| `09-formula-fragments/` | `FRAGMENT-HANDBOOK.md` | 公式碎片处理经验手册。 |
| `10-metadata-fetch/` | `10-metadata-fetch.ts` | metadata 获取与注入阶段入口。 |
| `11-quality-gate/` | `11-quality-gate.ts` | 写出前质量门：未解析短 `$...$` 碎片必须为 0，否则禁止生成 `out/*.kb.md`。 |
| `11-write-final/` | `11-write-final.ts` | 写出 `out/*.kb.md`，并处理 `alsoSimpleOut`。 |
| `12-inbox-sync/` | `12-inbox-sync.ts` | 对齐 inbox 源稿基名，重命名 `.md` / `.json`。 |
