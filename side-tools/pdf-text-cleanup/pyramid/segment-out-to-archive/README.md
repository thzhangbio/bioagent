# 段Ⅲ：out → archive

根总控：
- `segment-out-to-archive/index.ts`

当前职责：
- 读取 `out/.archive-ready.json` 或当前 `out/*.kb.md`
- 解析归档模式：`all` / `out-only` / `inbox-only`
- 计算归档目标目录
- 执行搬运
- 写 `archive/audit-log/*.json`
- 清理 `archive-ready` manifest

兼容入口：
- `archive-out.ts` → 转调 `out-only`
- `archive-inbox.ts` → 转调 `inbox-only`

默认命令：
- `pnpm run pdf-kb-out-to-archive`

| 子目录 | 职责（规划） |
|--------|----------------|
| `00-archive-trigger` | 触发条件（如仅入库成功后） |
| `01-target-paths` | `archive/ingested-out/`、`processed-mineru/` 等规则 |
| `02-idempotency` | 同名冲突与幂等策略 |
| `03-move-execute` | 实际搬运 |
| `04-inbox-archive-sidecar` | MinerU 源稿归档 |
| `05-audit-log` | 可选日志与追溯 |
