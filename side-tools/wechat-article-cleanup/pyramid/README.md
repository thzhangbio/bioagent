# 微信文章清洗 · 金字塔目录

本目录是 `wechat-article-cleanup` 的主实现区。

结构规则：

- 每个功能目录的根代码文件，与该目录同名，是该目录的总控
- 有子目录时，根代码文件负责调度子目录
- 无子目录时，根代码文件直接实现本层功能
- 根目录旧入口脚本只做兼容转调，不承载主实现

主线：

- `links -> inbox`
- `inbox -> out`
- `out -> knowledge`
- `out -> archive`

## 根目录文件

| 文件 | 作用 |
| --- | --- |
| `README.md` | 本目录导航，说明四段主线与阶段职责。 |
| `wechat-article-cleanup.ts` | 全流程总控。 |
| `stage-shared.ts` | 全流程共享上下文、参数与阶段名。 |

## 根目录子文件夹

| 文件夹 | 根总控 | 作用 |
| --- | --- | --- |
| `segment-links-to-inbox/` | `segment-links-to-inbox/segment-links-to-inbox.ts` | 读取 `links.txt`，抓取原始 HTML 进 `inbox/`。 |
| `segment-inbox-to-out/` | `segment-inbox-to-out/segment-inbox-to-out.ts` | 将 raw HTML 清洗为标准 Markdown，并显式加入来源、类别、结构语义。 |
| `segment-out-to-knowledge/` | `segment-out-to-knowledge/segment-out-to-knowledge.ts` | 将 `out/*.md` 送入统一知识库导入器。 |
| `segment-out-to-archive/` | `segment-out-to-archive/segment-out-to-archive.ts` | 归档 `inbox/` 与 `out/`。 |

## 核心设计

本次重构将以下三层变为显式阶段：

- 公众号来源层：`wechat_source_profile`
- 文章类别层：`wechat_article_category`
- 结构块层：图注 / 导流 / 文献 / 署名 / 尾注等
