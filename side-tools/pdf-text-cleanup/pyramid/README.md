# PDF 知识库流水线 · 金字塔目录

**塔尖（业务主线）**：`inbox` → `out` → `archive`（与仓库根目录下 `inbox/`、`out/`、`archive/` 对应）。

本目录现已是 `pdf-text-cleanup` 的主实现区，不再只是占位：
- 每个功能目录的**根代码文件**是该目录的总控
- 有子目录时，根代码文件负责调度子目录
- 无子目录时，根代码文件直接实现该层功能
- 旧入口脚本保留为兼容层，转调这里的新总控

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
| Ⅰ | `segment-inbox-to-out/` | 原始 MinerU 稿 → `*.kb.md`，根总控：`segment-inbox-to-out/segment-inbox-to-out.ts` |
| Ⅱ | `segment-out-to-knowledge/` | 成品进入知识库目录、`ingest`、验证、标记可归档，根总控：`segment-out-to-knowledge/segment-out-to-knowledge.ts` |
| Ⅲ | `segment-out-to-archive/` | 入库后 `out` / `inbox` 归档并写审计日志，根总控：`segment-out-to-archive/segment-out-to-archive.ts` |

各段下 **`00-…`～编号子文件夹** 对应该段的一级功能拆分；各子目录中的根代码文件就是该一级节点的总控或实现。

进度与勾选面板见：
- `COMPLETION-PLAN.md`

详见各段内 `README.md`。
