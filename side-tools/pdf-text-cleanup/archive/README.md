# archive — 两类归档（与 `wechat-article-cleanup` 对齐）

```
archive/
├── processed-mineru/   ← ① 已用 MinerU 稿生成 out/*.kb.md 并确认后，归档 inbox 内原始 .md/.json
│   └── YYYYMMDD-HHmmss/
├── ingested-out/       ← ② out 已向量化灌入 literature 后，归档 *.kb.md
│   └── YYYYMMDD-HHmmss/
└── （勿再平铺）历史若曾在 archive 根目录放过 .md/.json，请用 **`pdf-archive-legacy-flat`** 迁入 processed-mineru
```

| 命令 | 作用 |
|------|------|
| **`pnpm run pdf-archive-inbox`** | ① 归档 **inbox/** 中 MinerU 源文件 → `processed-mineru/<时间戳>/` |
| **`pnpm run pdf-archive-out`** | ② 归档 **out/** 中已入库的 `*.kb.md` → `ingested-out/<时间戳>/` |
| **`pnpm run pdf-archive-legacy-flat`** | 将 **archive/** 根目录遗留的 `.md`/`.json`（非 README）迁入 `processed-mineru/<时间戳>/` |

**不移动**尚未入库、仍需编辑的 `out/*.kb.md`；入库完成后再执行 **②**。
