# Segment: inbox -> out

本段负责：

- 读取 raw HTML
- 识别公众号来源线
- 识别文章类别线
- 解析结构块
- 渲染最终 Markdown
- 写入 `out/*.md`

后续可继续细分为：

- `00-entry-routing/`
- `01-source-profile/`
- `02-article-category/`
- `03-structure-blocks/`
- `04-markdown-render/`
- `05-write-final/`
