# 微信风格库入库前摘要

## 当前结论

- 旧 `wechat_style` 库 **暂不删除**
- 当前阶段 **不 append** 到旧库
- 最终确认后，使用 **`replace-collection`** 以新结构整体替换旧 `wechat_style`
- collection 仍然使用：
  - `wechat_style`
- style variant 仍然使用：
  - `medsci`

## 本次待入库来源

- 输入目录：
  - [side-tools/wechat-article-cleanup/out](/Users/tianhui/Webstart/bioagent/side-tools/wechat-article-cleanup/out)
- 文档数量：
  - 39 篇

## dry-run 结果

已执行：

```bash
pnpm run knowledge-import -- run --source wechat_style --input side-tools/wechat-article-cleanup/out --collection wechat_style --mode replace-collection --dry-run
```

结果：

- 标准化文档数：`39`
- 切块记录数：`1812`

最新 manifest：

- [2026-04-06T12-57-22-504Z__wechat_style.json](/Users/tianhui/Webstart/bioagent/data/knowledge/import-manifests/2026-04-06T12-57-22-504Z__wechat_style.json)

## 新 slot 结构

### 风格主槽位

- `title`
- `intro`
- `bridge`
- `subheading`
- `caption`
- `ending`

### 保留辅助槽位

- `body`
- `references`
- `byline`
- `footer`
- `diversion`

## 当前 slot 统计

- `title`: 39
- `intro`: 116
- `bridge`: 68
- `subheading`: 171
- `caption`: 115
- `ending`: 65

说明：

- `title / intro / bridge / subheading / caption / ending` 是后续主导生成时优先检索的风格槽位
- `body` 保留，主要作为整体语气和正文密度的兜底参考
- `references / byline / footer / diversion` 主要用于保留版式边界，不应主导正文写作

## 图注 subtype

当前 `caption` 已细分为：

- `paper_title_screenshot`
- `general`
- `figure_result`
- `figure_summary`
- `figure_mechanism`

当前统计：

- `paper_title_screenshot`: 7
- `general`: 75
- `figure_result`: 22
- `figure_summary`: 3
- `figure_mechanism`: 8

说明：

- 像“标题”这种来自论文首页截图的图注，已经归为 `paper_title_screenshot`
- 文末完整参考文献不应再进入 `caption`
- 后续若要继续收紧，可再把 `general` 继续拆分

## 为什么现在不直接删旧库

- 当前线上生成链路仍依赖 `wechat_style`
- 新结构虽然已经完成 `out` 与 importer 的打通，但还未正式替换生产库
- 保留旧库可作为回滚点，避免替换后难以恢复

## 为什么不建议 append

- 旧库使用的是旧 slot 语义
- 新库使用的是新的细槽位语义
- 若 append 到同一个 `wechat_style`，会导致：
  - 重复样本
  - 检索发散
  - 旧新结构混杂

因此建议最终只走一次：

- `replace-collection`

## 入库后如何主导生成

后续让风格库主导时，应按位置定向检索：

- 标题：优先检索 `title`
- 开头引入：优先检索 `intro`
- 段落承接：优先检索 `bridge`
- 小标题：优先检索 `subheading`
- 图注：优先检索 `caption`
- 结尾：优先检索 `ending`
- 正文兜底：参考 `body`

也就是说，风格库不再只是“混合参考”，而是按写作位置定向供样本。

## 当前代码准备情况

已完成：

- `out` 已重跑为适配新图注细分的版本
- importer 已能识别新 slot
- importer 已能识别 `caption` subtype
- `dry-run` 已通过
- TypeScript 校验已通过

关键文件：

- [types.ts](/Users/tianhui/Webstart/bioagent/src/knowledge/types.ts)
- [segment-load-to-normalized.wechat-shared.ts](/Users/tianhui/Webstart/bioagent/tools/knowledge-importer/pyramid/segment-load-to-normalized/segment-load-to-normalized.wechat-shared.ts)
- [segment-normalized-to-chunks.ts](/Users/tianhui/Webstart/bioagent/tools/knowledge-importer/pyramid/segment-normalized-to-chunks/segment-normalized-to-chunks.ts)
- [segment-chunks-to-store.ts](/Users/tianhui/Webstart/bioagent/tools/knowledge-importer/pyramid/segment-chunks-to-store/segment-chunks-to-store.ts)

## 下一步

你明确说“入库”之后，执行正式替换：

```bash
pnpm run knowledge-import -- run --source wechat_style --input side-tools/wechat-article-cleanup/out --collection wechat_style --mode replace-collection
```

替换完成后，再回到主线：

- 改造生成链路，让 `wechat_style(medsci)` 按 slot 定向检索，真正主导标题、引入、承接、小标题、图注和结尾。
