# archive — 两类归档（与 `wechat-article-cleanup` 对齐）

如果有人只被告知一句话：

> “把 `pdf-text-cleanup` 当前内容归档。”

那它应该执行的固定命令是：

```bash
pnpm run pdf-kb-archive
```

这条命令的**准确含义**是：

1. 把 `side-tools/pdf-text-cleanup/out/` 里当前所有 `*.kb.md` 移动到 `archive/ingested-out/<时间戳>/`
2. 把 `side-tools/pdf-text-cleanup/inbox/` 里当前所有 `.md` / `.json` 源文件移动到 `archive/processed-mineru/<时间戳>/`
3. 在 `archive/audit-log/<时间戳>.json` 写审计记录
4. 清掉 `out/.archive-ready.json`（如果存在）

它**不会**移动：

- `out/README.md`
- `out/kb-fragment-audit.md`
- `out/kb-fragment-list.md`
- `out/short-inline-math-inventory-*.md`
- `inbox/README.md`
- 其他不符合归档规则的文件

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
| **`pnpm run pdf-kb-archive`** | 一次性归档当前 `out/*.kb.md` 与 `inbox/*.md/.json`；推荐默认入口 |
| **`pnpm run pdf-archive-inbox`** | ① 归档 **inbox/** 中 MinerU 源文件 → `processed-mineru/<时间戳>/` |
| **`pnpm run pdf-archive-out`** | ② 归档 **out/** 中已入库的 `*.kb.md` → `ingested-out/<时间戳>/` |
| **`pnpm run pdf-archive-legacy-flat`** | 将 **archive/** 根目录遗留的 `.md`/`.json`（非 README）迁入 `processed-mineru/<时间戳>/` |

## 何时允许归档

只有在下面条件成立时才运行归档：

1. `out/*.kb.md` 已经是终稿
2. 终稿已经入知识库
3. 不再需要把这些文件留在 `out/` 或 `inbox/` 继续编辑

如果只想归档一侧，也可以拆开执行：

- 只归档 `out/`：`pnpm run pdf-archive-out`
- 只归档 `inbox/`：`pnpm run pdf-archive-inbox`

**不移动**尚未入库、仍需编辑的 `out/*.kb.md`；入库完成后再执行归档。
