# 段Ⅲ：out → archive

入库完成后，将 `out` / 侧车 `inbox` 迁至 `archive/`；与现有 `archive-out.ts`、`archive-inbox.ts` 等对齐后，按子目录拆分实现。

| 子目录 | 职责（规划） |
|--------|----------------|
| `00-archive-trigger` | 触发条件（如仅入库成功后） |
| `01-target-paths` | `archive/ingested-out/`、`processed-mineru/` 等规则 |
| `02-idempotency` | 同名冲突与幂等策略 |
| `03-move-execute` | 实际搬运 |
| `04-inbox-archive-sidecar` | MinerU 源稿归档 |
| `05-audit-log` | 可选日志与追溯 |
