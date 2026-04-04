# inbox — 原始内容

- **自动**：`pnpm run wechat-article-pipeline` 根据 `links.txt` 抓取，生成 **`*.raw.html`**（含 HTTP 注释头）。
- **手动**：验证页可另存 HTML 为 **`{slug}.raw.html`**。

**归档 ①**：在 **out 已生成且满意** 后，运行 **`pnpm run wechat-article-archive-inbox`**，将本目录 `*.raw.html` 移至 **`archive/processed-inbox/<时间戳>/`**，腾空 inbox。

勿提交敏感 Cookie；大文件可 `.gitignore`。
