# inbox — MinerU 原始导出（可选工作流）

将待跑 `pdf-kb-pipeline` 的 **MinerU `.md`**（及同篇 **`.json`**，若使用）放在此目录，便于与 **`out/`**、**`archive/`** 区分。

成功跑完流水线（且未使用 `--out` / `--no-rename-inbox`）后，**`inbox` 内的源 `.md` / `.json` 会改名为与 `out/` 终稿相同的基名**（时间戳+slug+DOI 段），与 **`*.kb.md`** 一一对应。

同一篇论文如果重复清洗，当前主线会自动按 DOI 清理旧命名版本，避免 `inbox/` 与 `out/` 长期积累重复稿。

**归档 ①**：已生成 **`out/*.kb.md`** 且校对满意后，执行 **`pnpm run pdf-archive-inbox`**，将本目录中的 `.md` / `.json` 移至 **`archive/processed-mineru/<时间戳>/`**，腾空 inbox。

若仍从仓库任意路径传 `--raw-md`，可手动将用过的 MinerU 文件移入 **`archive/processed-mineru/<时间戳>/`**，语义与上一致。
