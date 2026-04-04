# 微信公众号文章清洗（侧车工具）

与主项目解耦：**`links.txt`** → **`inbox/`** 原始 HTML → **`out/`** 清洗 Markdown → **`archive/`** 分两类归档。

## 目录

| 路径 | 作用 |
|------|------|
| `links.txt` | 每行一条 `https://mp.weixin.qq.com/s/...`，`#` 为注释 |
| `inbox/` | 抓取或手动的 **`*.raw.html` 全文** |
| `out/` | 清洗后的 **`*.md`**（待校对、灌库） |
| `archive/` | 两类子目录，见下节 |

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
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html` | 单篇清洗到 `out/xxx.md` |
| `pnpm run wechat-article-clean -- inbox/xxx.raw.html --strip-footer` | 单篇清洗并裁壳子尾部（`--` 后为传给脚本的参数） |

## 合规与预期

- 仅用于**有权使用**的原文；遵守微信平台规则与著作权。
- 服务端 `fetch` 可能返回**验证页**；可将真实 HTML 放入 `inbox/` 后 **`--clean-only`**。
- 清洗规则见 `clean-article.ts`。**默认保留文末**（含运营话术、版权声明、转载说明等），便于对照写自家声明；若只要去掉微信里偏「壳子」的预览/英文关注提示，可在 pipeline 或单篇 `cli` 上加 **`--strip-footer`**（不会按默认裁掉版权声明类段落）。
- **阶段性小标题**：微信常用「蓝字 + 粗体」的 `<p>`/`<span>`（非 `h2`）。清洗器在 `#js_content` 内按段落解析，将匹配 **rgb(59,115,185) / rgb(76,119,175)** 且 **粗体**、且全文 **≤48 字**的段落输出为 Markdown **`##`**；更长但同样式的蓝粗段视为正文要点，不升格为标题。`</section>` 会换行，避免图注与下一段粘连。

## 与知识库

清洗后的 `out/*.md` 经校对、标注 `wechatStyleVariant` 等后，再执行 **ingest**（规划中的 `wechat_style` 灌库）；**入库成功后**再执行归档 **②**。
