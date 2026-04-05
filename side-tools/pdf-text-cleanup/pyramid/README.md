# PDF 知识库流水线 · 金字塔目录

**塔尖（业务主线）**：`inbox` → `out` → `archive`（与仓库根目录下 `inbox/`、`out/`、`archive/` 对应，本目录为**步骤级代码占位与规划**，逐步迁入实现）。

```
                    inbox → out → archive
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 segment-inbox-to-out   segment-out-to-   segment-out-to-archive
                        knowledge
```

| 段 | 文件夹 | 说明 |
|----|--------|------|
| Ⅰ | `segment-inbox-to-out/` | 原始 MinerU 稿 → `*.kb.md`（当前总指挥多为 `pipeline.ts`，逻辑将按子目录逐步拆分） |
| Ⅱ | `segment-out-to-knowledge/` | 成品进入主仓知识库目录、`ingest` 等（**实现多在项目根**，此处为步骤占位与约定） |
| Ⅲ | `segment-out-to-archive/` | 入库后 `out` / `inbox` 归档（与 `archive-*.ts` 对齐，将按子目录拆分） |

各段下 **`00-…`～编号子文件夹** 对应规划中的子阶段；迁入代码时建议每步一个（或少量）模块，由段级 `orchestrator`（未来）编排。

详见各段内 `README.md`。
