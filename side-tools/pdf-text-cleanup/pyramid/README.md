# PDF 知识库流水线 · 金字塔目录

本目录是 `pdf-text-cleanup` 的主实现区。

结构规则：
- 每个功能目录的根代码文件，与该目录同名，是该目录的总控。
- 有子目录时，根代码文件负责调度子目录。
- 无子目录时，根代码文件直接实现本层功能。
- 旧入口脚本只做兼容转调，不再承载主实现。

主线：
- `inbox/` → `out/` → `archive/`

## 根目录文件

| 文件 | 作用 |
| --- | --- |
| `README.md` | 本目录导航，说明三段主线、根文件与子目录职责。 |
| `COMPLETION-PLAN.md` | 重构完成规划与勾选进度。 |

## 根目录子文件夹

| 文件夹 | 根总控 | 作用 |
| --- | --- | --- |
| `segment-inbox-to-out/` | `segment-inbox-to-out/segment-inbox-to-out.ts` | MinerU 原始稿进入清洗链路，产出 `out/*.kb.md`。 |
| `segment-out-to-knowledge/` | `segment-out-to-knowledge/segment-out-to-knowledge.ts` | 将 `out` 成稿复制进知识库目录、触发 ingest、做最小验证并标记可归档。 |
| `segment-out-to-archive/` | `segment-out-to-archive/segment-out-to-archive.ts` | 入库后归档 `out` 与 `inbox`，并写审计日志。 |
| `tools/pdf-cleanup/` | `tools/pdf-cleanup/pdf-cleanup.ts` | 面向单文件的通用清洗入口，用于快速查看 `cleanPdfTextMd` 的整理效果。 |

## README 覆盖范围

- `segment-inbox-to-out/README.md`
  - 说明段Ⅰ根目录下的共享代码文件、经验手册，以及 `00` 到 `12` 子目录。
- `segment-out-to-knowledge/README.md`
  - 说明段Ⅱ根目录文件与 `00` 到 `05` 子目录。
- `segment-out-to-archive/README.md`
  - 说明段Ⅲ根目录文件、兼容归档子层与 `00` 到 `05` 子目录。
