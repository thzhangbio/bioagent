# 段Ⅲ：out → archive

本目录负责在入库完成后，归档 `out` 成稿和 `inbox` 源稿，并写入追溯日志。

## 根目录代码文件

| 文件 | 作用 |
| --- | --- |
| `segment-out-to-archive.ts` | 段Ⅲ总控，依次调度 `00` 到 `05`。 |
| `segment-out-to-archive.archive-stamp.ts` | 归档时间戳与目录命名共享逻辑。 |
| `stage-shared.ts` | 段Ⅲ共享上下文、阶段名与状态记录。 |
| `README.md` | 段Ⅲ目录说明。 |

## 一级子目录

| 子目录 | 根文件 | 作用 |
| --- | --- | --- |
| `00-archive-trigger/` | `00-archive-trigger.ts` | 解析触发条件与归档模式。 |
| `01-target-paths/` | `01-target-paths.ts` | 计算 `archive/ingested-out/`、`archive/processed-mineru/` 等目标路径。 |
| `02-idempotency/` | `02-idempotency.ts` | 处理冲突、覆盖与幂等策略。 |
| `03-move-execute/` | `03-move-execute.ts` | 实际执行文件搬运。 |
| `04-inbox-archive-sidecar/` | `04-inbox-archive-sidecar.ts` | 归档与成稿对应的 MinerU 源稿 sidecar。 |
| `05-audit-log/` | `05-audit-log.ts` | 写归档审计日志。 |
| `legacy-flat-archive/` | `legacy-flat-archive.ts` | 兼容旧式平铺归档脚本。 |

## 命令入口

- `pnpm run pdf-kb-out-to-archive`
- `pnpm run pdf-archive-out`
- `pnpm run pdf-archive-inbox`
- `pnpm run pdf-archive-legacy-flat`
