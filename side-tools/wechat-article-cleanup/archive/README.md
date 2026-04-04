# archive — 两类归档

```
archive/
├── processed-inbox/   ← ① 流水线产出 out 并确认无误后，归档 inbox 原始 *.raw.html
│   └── YYYYMMDD-HHmmss/
└── ingested-out/      ← ② out 已向量化入库后，归档成品 *.md
    └── YYYYMMDD-HHmmss/
```

- **① `pnpm run wechat-article-archive-inbox`**：处理完、生成好 **out** 后，把 **inbox** 里已用过的原始稿移走，避免与下一批混淆。  
- **② `pnpm run wechat-article-archive-out`**：**灌库完成**后，把 **out** 里已入库的 md 移走，腾空 out。

旧版若存在 **`archive/<时间戳>/` 扁平目录**（仅 out），可手工合并进 `ingested-out/` 或保留不动。
