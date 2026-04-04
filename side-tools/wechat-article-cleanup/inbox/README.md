# inbox — 原始内容

- **自动**：`pnpm run wechat-article-pipeline` 根据 `links.txt` 抓取，生成 **`{公众号名}+{标题}.raw.html`**（含 HTTP 注释头）。
- **手动**：验证页可另存为任意名如 **`{短链}.raw.html`**；**跑完清洗**后会自动 **重命名** 为与 **`out/*.md`** 一致的 **`{公众号名}+{标题}.raw.html`**。

**归档 ①**：在 **out 已生成且满意** 后，运行 **`pnpm run wechat-article-archive-inbox`**，将本目录 `*.raw.html` 移至 **`archive/processed-inbox/<时间戳>/`**，腾空 inbox。

勿提交敏感 Cookie；大文件可 `.gitignore`。
