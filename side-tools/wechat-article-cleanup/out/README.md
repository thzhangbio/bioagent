# out — 清洗后输出

- 由清洗流程生成 **`*.md`**；文件名一般为 **`{公众号名}+{文章标题}.md`**（文首含 `url`、`kb_wechat_id` 等）。
- **校对、向量化灌库**（如 `wechat_style`）在仓库主流程中完成。

**归档 ②**：**入库成功后**，运行 **`pnpm run wechat-article-archive-out`**，将本目录成品 md 移至 **`archive/ingested-out/<时间戳>/`**，腾空 out。
