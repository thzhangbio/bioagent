# 微信公众号文章清洗（侧车工具）

与主项目解耦：**`links.txt`** → **`inbox/`** 原始 HTML → **`out/`** 清洗 Markdown → **`archive/`** 分两类归档。

## 目录

| 路径 | 作用 |
|------|------|
| `links.txt` | 每行一条 `https://mp.weixin.qq.com/s/...`，`#` 为注释 |
| `inbox/` | 抓取或手动的 **`*.raw.html` 全文** |
| `out/` | 清洗后的 **`*.md`**（待校对、灌库）；YAML 头含 **`wechat-meta.ts`** 抽取的运营字段，见下节 |
| `wechat-meta.ts` | 从页面 HTML 解析 **`title` / `is_original` / `editor` / `mp_name` / `published_at` / `published_at_cn`** |
| `wechat-kb-id.ts` | 计算 **`kb_wechat_id`**：灌库与后续补数据时的稳定唯一键（见下节） |
| `appmsg-stats.ts` | 可选：通过 `getappmsgext` 拉取 **阅读 / 点赞 / 分享 / 评论 / 收藏** 等互动数（需 Cookie，见下节） |
| `archive/` | 两类子目录，见下节 |

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
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html` | 单篇清洗到 `out/xxx.md` |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html --strip-footer` | 单篇清洗并裁壳子尾部（`--` 后为传给脚本的参数） |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html --fetch-stats` | 单篇清洗并写入互动数据（需 `WECHAT_MP_COOKIE`） |

## 合规与预期

- 仅用于**有权使用**的原文；遵守微信平台规则与著作权。
- 服务端 `fetch` 可能返回**验证页**；可将真实 HTML 放入 `inbox/` 后 **`--clean-only`**。
- 清洗规则见 `clean-article.ts`。**默认保留文末**（含运营话术、版权声明、转载说明等），便于对照写自家声明；若只要去掉微信里偏「壳子」的预览/英文关注提示，可在 pipeline 或单篇 `cli` 上加 **`--strip-footer`**（不会按默认裁掉版权声明类段落）。
- **阶段性小标题**：微信常用「蓝字 + 粗体」的 `<p>`/`<span>`（非 `h2`）。清洗器在 `#js_content` 内按段落解析，将匹配 **rgb(59,115,185) / rgb(76,119,175)** 且 **粗体**、且全文 **≤48 字**的段落输出为 Markdown **`##`**；更长但同样式的蓝粗段视为正文要点，不升格为标题。`</section>` 会换行，避免图注与下一段粘连。
- **图注（非正文）**：常见 **灰色 `rgb(136,136,136)`**（多在插图下方、`</section>` 内或独立 `<p>`）。会先排除「注：」全文说明、参考资料、撰文/编辑、转载与联系方式、DeepEvidence 导流等同类灰字，**仅**对仍判定为插图说明的输出 **`> 图注：…`**。**嵌在配图截图里的英文刊头 /「Article number」等**若未以可选文字出现在 HTML 中，则无法从抓取结果恢复，需 OCR 或人工补录。
- **非正文元信息**（与正文、图注区分）：对上述排除项及同类导流句，输出为引用块 **`> [属性] …`**，属性含：`导流`、`注释`、`参考资料`、`文献`、`署名·撰文`、`署名·编辑`、`转载说明`、`联系方式`、`运营`。

## 与知识库

清洗后的 `out/*.md` 经校对、标注 `wechatStyleVariant` 等后，再执行 **ingest**（规划中的 `wechat_style` 灌库）；**入库成功后**再执行归档 **②**。
