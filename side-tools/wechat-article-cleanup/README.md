# 微信公众号文章清洗（侧车工具）

与主项目解耦：**`links.txt`** → **`inbox/`** 原始 HTML → **`out/`** 清洗 Markdown → **`archive/`** 分两类归档。

当前主实现已迁入 **`pyramid/`**：

- 段Ⅰ：`pyramid/segment-links-to-inbox/`
- 段Ⅱ：`pyramid/segment-inbox-to-out/`
- 段Ⅲ：`pyramid/segment-out-to-knowledge/`
- 段Ⅳ：`pyramid/segment-out-to-archive/`

旧入口脚本（`pipeline.ts`、`cli.ts`、`archive-*.ts`）现仅作兼容转调，不再承载主实现。

## 梅斯学术 vs 良医汇

- **梅斯学术**（及非「良医汇」账号）：**正常**抓取 → `inbox` → 清洗 → `out`；YAML 中 `wechat_style_variant: medsci` 由启发式写入（见 `clean-article.ts`）。
- **良医汇**：解析到的 **`mp_name` 含「良医汇」**时，默认**不写入 inbox**（抓取阶段），**不生成 out**（清洗阶段）；URL 追加到 **`links-liangyi-deferred.txt`**，待标杆范文确立后再跑 **`--no-liangyi-skip`** 或改策略。  
  若某篇实际为梅斯但被误判，请检查 HTML 里 `nick_name` 是否异常；调试可 **`--no-liangyi-skip`**。

## 目录

| 路径 | 作用 |
|------|------|
| `links.txt` | 每行一条 `https://mp.weixin.qq.com/s/...`，`#` 为注释；**去重**由解析器完成 |
| `links-liangyi-deferred.txt` | **良医汇**链接自动搁置列表（抓取识别到公众号名含「良医汇」时追加，**不入 inbox**；标杆范文确立后再处理） |
| `inbox/` | 抓取或手动的 **`*.raw.html` 全文**；清洗成功后会 **重命名为** 与 **`out/*.md` 同基名**（短链占位名会被替换） |
| `out/` | 清洗后的 **`*.md`**；当前可输出为“**风格槽位提取版**”，文件名 **`{公众号名}+{文章标题}`**（非法字符已替换、过长已截断，见 `wechat-article-filename.ts`） |
| `wechat-meta.ts` | 从页面 HTML 解析 **`title` / `is_original` / `editor` / `mp_name` / `published_at` / `published_at_cn`** |
| `wechat-article-filename.ts` | 生成 **`公众号名+标题`** 安全文件名片段；抓取 raw 与输出 md 同名（仅扩展名不同） |
| `wechat-kb-id.ts` | 计算 **`kb_wechat_id`**：灌库与后续补数据时的稳定唯一键（见下节） |
| `appmsg-stats.ts` | 可选：通过 `getappmsgext` 拉取 **阅读 / 点赞 / 分享 / 评论 / 收藏** 等互动数（需 Cookie，见下节） |
| `archive/` | 两类子目录，见下节 |
| `pyramid/` | 主实现区：按 `links -> inbox -> out -> knowledge -> archive` 金字塔式组织 |

### `kb_wechat_id`（知识库主键，类比文献 DOI）

每篇清洗文 **必有** `kb_wechat_id`，用于：

- 与后续补录的 **互动指标**、**运营备注** 等挂在 **同一篇** 上；
- 向量化 / 入库时 **去重、合并、更新**（同一 `kb_wechat_id` 视为同一文档）。

**生成规则**（`wechat-kb-id.ts`）：

1. **优先**：HTML 内 `biz`、`mid`、`idx`、`sn` → `mp1|<biz>|<mid>|<idx>|<sn>`（与微信消息一致，换短链形式不变）。
2. **否则**：文章 URL 的 `/s/` 后 token → `mp1|s|<token>`。
3. **再否则**：inbox 文件名中的片段 → `mp1|s|<slug>`。
4. **极罕见**：以上皆无 → `mp1|h|<内容哈希前缀>`（同一份 raw 稳定）。

互动数据 **可留空**；日后用任意方式拿到统计后，按 **`kb_wechat_id`** 对齐写入即可再灌库。

### `out/*.md` 的 YAML 头（运营参考）

| 字段 | 含义 |
|------|------|
| `kb_wechat_id` | 知识库主键（见上一节）；**勿手改**，除非确认与微信侧一致 |
| `title` | 文章标题（`msg_title` / `og:title`） |
| `is_original` | 是否标为原创（`copyright_stat` / `#copyright_logo`） |
| `editor` | 文首作者/编辑展示名（meta `author` / `#js_author_name_text`） |
| `mp_name` | 公众号名称（`nick_name` 等） |
| `published_at` | 发布时间 ISO 8601（来自 `ori_create_time` 等 Unix 秒） |
| `published_at_cn` | 东八区可读时间，与微信界面一致便于对照 |

另含 `url`、`fetchedAt`（抓取侧）；正文内 **`[导流]`** 等非正文标记见 `clean-article.ts` / 合规与预期一节。

### 新增显式治理字段

本次重构后，清洗成品会显式写入：

| 字段 | 含义 |
|------|------|
| `wechat_source_profile` | 公众号来源线，如 `medsci` / `liangyi_hui` / `generic_wechat` |
| `wechat_article_category` | 文章类别线，如 `literature_digest` / `conference_news` / `activity_promo` 等 |
| `wechat_style_source` | 风格来源标签；当前通常与 `wechat_source_profile` 一致，用于向量库抗污染 |
| `wechat_style_genre` | 风格文体标签；当前通常与 `wechat_article_category` 一致 |
| `wechat_style_task` | 风格任务标签，如 `literature_to_wechat` / `news_to_wechat` / `promo_to_wechat` |

这些字段用于后续按公众号、按内容类别、按生成任务分别细化清洗规则与入库策略，避免不同公众号或同一公众号不同文体混检。

### 互动数据（可选，`--fetch-stats`）

静态 HTML **不含**真实阅读量等数字（多为占位）。流水线可额外请求 `mp/getappmsgext`，将结果写入 YAML（字段前缀 `stats_`）：

| 字段 | 含义 |
|------|------|
| `stats_read` | 阅读量 |
| `stats_old_like` | 旧版「赞」数（若接口返回） |
| `stats_like` | 点赞 / 在看相关计数（接口字段因版本而异） |
| `stats_share` | 转发量 |
| `stats_comment` | 评论数（主文） |
| `stats_collect` | 收藏数（若接口返回） |
| `stats_fetched_at` | 拉取互动数据的时间（ISO 8601） |
| `stats_fetch_error` | 失败原因（如无 Cookie 时常见 `no_appmsgstat`） |

**用法**：在已登录微信的浏览器中打开 `mp.weixin.qq.com` 文章页，从开发者工具复制 **Cookie**，设置环境变量 **`WECHAT_MP_COOKIE`**，再执行带 **`--fetch-stats`** 的 pipeline 或单篇清洗。未设置 Cookie 时仍会尝试请求，但通常拿不到 `appmsgstat`，YAML 中可能仅有 `stats_fetch_error`。

**常见卡点（尤其 Mac）**：用 **Chrome / Safari 直接打开文章链接** 时，常出现「需登录、且仅允许手机查看」等限制，**拿不到与微信客户端一致的 Cookie**，`--fetch-stats` 会失败。而 **Mac 微信内置浏览器**里往往能看到阅读量、点赞、转发等，但该窗口**一般没有开发者工具**，无法像普通网页那样复制 Cookie。

可行替代：

| 做法 | 说明 |
|------|------|
| **系统 HTTPS 代理抓包** | 在 Mac 上为微信开启系统代理（Charles、Proxyman、mitmproxy 等），在微信里打开同一篇文章，在抓包记录里筛选 **`getappmsgext`**，从该请求的 **Request Headers** 里复制完整 **`Cookie`**（以及若脚本需要可对照 **Payload** 里的 `key` / `pass_ticket` 等）。注意安装并信任抓包证书，且微信可能对部分连接做证书固定，不一定 100% 成功。 |
| **能登录的浏览器会话** | 若你能在 **桌面浏览器**里正常打开该文（例如已用扫码登录过网页版、或未触发「仅手机查看」），仍可用 Network → `getappmsgext` → Cookie 的方式。 |
| **手工补 YAML** | 不跑 `--fetch-stats`，在生成好的 `out/*.md` 里于 front matter **手动增加** `stats_read`、`stats_like`、`stats_share`、`stats_comment`、`stats_collect` 等（与上表字段名一致），把 Mac 微信里看到的数字填进去；可另加一行 `stats_note: manual` 标明人工录入，便于区分。 |

## 两类归档（不要混用）

| 步骤 | 时机 | 命令 | 归档位置 | 腾空 |
|------|------|------|----------|------|
| **① 流水线后** | 已用 inbox 生成 out，且 **确认 md 质量 OK**，不再需要改 raw | `pnpm run wechat-article-archive-inbox` | `archive/processed-inbox/<时间戳>/` | **`inbox/`**（移走 `*.raw.html`） |
| **② 入库后** | **`out/*.md` 已向量化写入知识库**（如 `wechat_style`），确认入库成功 | `pnpm run wechat-article-archive-out` | `archive/ingested-out/<时间戳>/` | **`out/`**（移走成品 md） |

典型顺序：**抓取/清洗** → 校对 **out** → 执行 **①**（清 inbox）→ 灌库 → 执行 **②**（清 out）。若尚未灌库就想清空 out，仍用 **②** 语义上略偏，建议先备份或改手动移动。

## 其他命令

| 命令 | 说明 |
|------|------|
| `pnpm run wechat-article-pipeline` | 读 `links.txt` → 抓取 → `inbox` → 清洗 → `out` |
| `pnpm run wechat-article-pipeline -- --fetch-only` | 仅抓取 |
| `pnpm run wechat-article-pipeline -- --clean-only` | 仅根据 `inbox/*.raw.html` 生成 `out` |
| `pnpm run wechat-article-pipeline -- --clean-only --strip-footer` | 同上，并裁掉微信页尾部少量「壳子」提示（保留版权声明等） |
| `pnpm run wechat-article-pipeline -- --clean-only --fetch-stats` | 清洗并写入互动数据（需 `WECHAT_MP_COOKIE`） |
| `pnpm run wechat-article-pipeline -- --fetch-only --no-liangyi-skip` | 抓取时**不过滤**良医汇（调试用；默认会搁置良医汇） |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html` | 单篇清洗到 `out/xxx.md` |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html --strip-footer` | 单篇清洗并裁壳子尾部（`--` 后为传给脚本的参数） |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html --fetch-stats` | 单篇清洗并写入互动数据（需 `WECHAT_MP_COOKIE`） |
| `pnpm run wechat-article-out-to-knowledge` | 将 `out/*.md` 送入统一知识库导入器（`wechat_style`） |
| `pnpm run wechat-article-out-to-archive -- --mode out-only` | 归档 `out/*.md` |

## 合规与预期

- 仅用于**有权使用**的原文；遵守微信平台规则与著作权。
- 服务端 `fetch` 可能返回**验证页**；可将真实 HTML 放入 `inbox/` 后 **`--clean-only`**。
- 清洗规则见 `clean-article.ts`。**默认保留文末**（含运营话术、版权声明、转载说明等），便于对照写自家声明；若只要去掉微信里偏「壳子」的预览/英文关注提示，可在 pipeline 或单篇 `cli` 上加 **`--strip-footer`**（不会按默认裁掉版权声明类段落）。
- **阶段性小标题**：微信常用「蓝字 + 粗体」的 `<p>`/`<span>`（非 `h2`）。清洗器在 `#js_content` 内按段落解析，将匹配 **rgb(59,115,185) / rgb(76,119,175)** 且 **粗体**、且全文 **≤48 字**的段落输出为 Markdown **`##`**；更长但同样式的蓝粗段视为正文要点，不升格为标题。`</section>` 会换行，避免图注与下一段粘连。
- **图注（非正文）**：常见 **灰色 `rgb(136,136,136)`**（多在插图下方、`</section>` 内或独立 `<p>`）。会先排除「注：」全文说明、参考资料、撰文/编辑、转载与联系方式、DeepEvidence 导流等同类灰字，**仅**对仍判定为插图说明的输出 **`> 图注：…`**。**嵌在配图截图里的英文刊头 /「Article number」等**若未以可选文字出现在 HTML 中，则无法从抓取结果恢复，需 OCR 或人工补录。
- **非正文元信息**（与正文、图注区分）：对上述排除项及同类导流句，输出为引用块 **`> [属性] …`**，属性含：`导流`、`注释`、`参考资料`、`文献`、`署名·撰文`、`署名·编辑`、`转载说明`、`联系方式`、`运营`。
- **归档 Markdown 回灌**：`segment-inbox-to-out` 现在除支持 `*.raw.html` 外，也支持把已归档的 `*.md` 重新放回 `inbox/` 再处理。适用于对既有样本文本做二次提取，而无需重新抓取微信原始页。
- **风格槽位提取**：当前 `out/*.md` 可自动提取并显式输出以下槽位，供后续评审和入库策略讨论：
  - `标题`
  - `引入`
  - `承接`
  - `小标题`
  - `图注`
  - `结尾`
  同一文件内保留 `## 原文正文（清洗版）`，便于对照审核。

## 与知识库

处理结果与入库约定以 **`docs/知识库分层与文献库规划.md`** **§6.2** 为准，摘要如下：

| 项目 | 约定 |
|------|------|
| **输入灌库的成品** | 本目录 **`out/*.md`**（含 YAML 与正文；**保留** `> [导流]`、`> [文献]`、`署名·*` 等块，供 `wechat_style` 学结构与槽位形态）。 |
| **主键** | 文首 **`kb_wechat_id`**，向量化时建议写入块元数据，便于去重与审计。 |
| **子风格** | 文内 YAML **`wechat_style_variant`**（清洗器按公众号名启发式写入）或 **`.meta.json`**；灌库时写入块级 **`wechatStyleVariant`**。 |
| **抗污染标签** | 入库时同步写入 **`wechatStyleSource`**、**`wechatStyleGenre`**、**`wechatStyleTask`**，分别对应来源、文体、任务。 |
| **槽位** | **`pnpm run ingest:wechat`** 按段落打 **`wechatContentSlot`**（`title` / `intro` / `bridge` / `subheading` / `caption` / `ending` / `body` / `references` / `byline` / `footer`），图注另带 **`wechatCaptionKind`**。 |
| **事实** | 医学事实与可核对引用以 **`literature`** 为准；微信库仅表达层。 |
| **可选第二步** | 若需「仅窄句」第二条管道，可从同批 md 再导出片段——见《知识库分层》§6.2.2。 |

校对无误后在仓库根执行 **`pnpm run ingest:wechat`**（**仅替换** `wechat_style`）；**入库成功后**再执行归档 **②**。
