# 段Ⅱ：out → 知识库

本目录负责把 `out/*.kb.md` 送入知识库目录，执行 ingest，并为归档准备 manifest。

## 根目录代码文件

| 文件 | 作用 |
| --- | --- |
| `segment-out-to-knowledge.ts` | 段Ⅱ总控，依次调度 `00` 到 `05`。 |
| `stage-shared.ts` | 段Ⅱ共享上下文、阶段名与状态记录。 |
| `README.md` | 段Ⅱ目录说明。 |

## 一级子目录

| 子目录 | 根文件 | 作用 |
| --- | --- | --- |
| `00-pre-out-check/` | `00-pre-out-check.ts` | 入库前检查 `out` 目录与运行前提。 |
| `01-copy-to-knowledge/` | `01-copy-to-knowledge.ts` | 将成稿复制到知识库约定目录。 |
| `02-metadata-id/` | `02-metadata-id.ts` | 对齐 DOI、slug、paperId 等标识。 |
| `03-ingest-index/` | `03-ingest-index.ts` | 调用知识库 ingest 入口。 |
| `04-verify-search/` | `04-verify-search.ts` | 做最小搜索 / 索引验证。 |
| `05-mark-ready-archive/` | `05-mark-ready-archive.ts` | 写 `out/.archive-ready.json`，供段Ⅲ消费。 |

## 命令入口

- `pnpm run pdf-kb-out-to-knowledge`
