# 微信风格槽位化进度

## 当前目标

围绕 `side-tools/wechat-article-cleanup` 建立一条可重复执行的“梅斯学术风格槽位提取”流程，先不入库，先产出可审核的 `out/*.md` 中间结果，等确认后再决定最佳入库方式。

## 当前已完成

- 已将 `archive/ingested-out/20260404-184344` 的 **39 篇梅斯学术归档稿**重新复制回：
  - [side-tools/wechat-article-cleanup/inbox](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/inbox)
- 已修改微信公众号清洗工具，使 `segment-inbox-to-out` 同时支持两类输入：
  - `*.raw.html`
  - 已归档的 `*.md`
- 已在清洗链路中加入“风格槽位提取”，当前提取槽位为：
  - `标题`
  - `引入`
  - `承接`
  - `小标题`
  - `图注`
  - `结尾`
- 已让 `out/*.md` 输出为“风格提取 + 原文正文（清洗版）”的一体文件，便于人工审核。
- 已实际运行：
  - `pnpm run wechat-article-pipeline -- --clean-only`
- 已成功生成 39 篇新的 `out` 文件：
  - [side-tools/wechat-article-cleanup/out](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/out)

## 本轮改动位置

- [README.md](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/README.md)
- [stage-shared.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/stage-shared.ts)
- [wechat-article-filename.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/shared/wechat-article-filename.ts)
- [markdown-frontmatter.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/shared/markdown-frontmatter.ts)
- [clean-article.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/shared/clean-article.ts)
- [00-entry-routing.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/00-entry-routing/00-entry-routing.ts)
- [01-source-profile.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/01-source-profile/01-source-profile.ts)
- [03-structure-blocks.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/03-structure-blocks/03-structure-blocks.ts)
- [04-markdown-render.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/04-markdown-render/04-markdown-render.ts)
- [segment-inbox-to-out.structure.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/segment-inbox-to-out.structure.ts)
- [segment-inbox-to-out.style-slots.ts](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/pyramid/segment-inbox-to-out/segment-inbox-to-out.style-slots.ts)

## 当前产物格式

每篇 `out/*.md` 当前包含：

- 原始 YAML 元信息
- `wechat_style_slot_schema: "medsci-style-slots-v1"`
- `## 风格提取`
  - `### 标题`
  - `### 引入`
  - `### 承接`
  - `### 小标题`
  - `### 图注`
  - `### 结尾`
- `## 原文正文（清洗版）`

## 已知边界

- 小标题提取目前采用启发式规则，能抓到大量梅斯式短标题，但仍可能把个别强承接句也识别成“小标题候选”。
- 图注提取对显式图注效果较好，但若原文根本没有显式图注文本，当前会返回空。
- `wechat_article_category` 仍沿用旧的启发式分类，对部分梅斯文献稿分类不一定准确；本轮重点不在文章分类，而在风格槽位提取。

## 下一步待你拍板

在真正入库前，需要先和你确认这几件事：

1. `out/*.md` 这种“风格提取 + 原文正文”一体格式，是否就是你要审阅的版本。
2. 风格槽位是否还要继续细分，例如把 `承接` 再拆成：
   - `开头过渡`
   - `中段翻译句`
   - `结尾升华句`
3. 图注是否要再细分为：
   - `DOI/刊头类`
   - `实验结果图注`
   - `机制图注`
4. 入库时到底是：
   - 直接整篇入 `wechat_style`
   - 还是按槽位分块入库
   - 还是“整篇 + 槽位”双轨并存

## 回到主线时要做什么

当这批风格提取版本确认后，再决定入库方案。等你明确说“入库”之后，再做知识库导入。入库完成，再回到当前主线任务：

- 让 `wechat_style(medsci)` 真正主导生成时的：
  - 标题
  - 引入
  - 承接
  - 小标题
  - 图注
  - 结尾

也就是说，后续不是继续堆 prompt，而是把这批槽位化风格样本真正用于检索和生成。
