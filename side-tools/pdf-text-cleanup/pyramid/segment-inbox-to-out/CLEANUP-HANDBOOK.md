# 非公式清洗经验手册

用途：
- 记录 `segment-inbox-to-out` 中不属于 `$...$` 公式碎片、但会明显影响向量化质量的清洗经验。
- 重点沉淀 HTML 残留、页眉页脚、publisher boilerplate、结构噪声这类规则。

适用层：
- `03-mineru-preliminary`
- `05-headers-footers-pages`
- `07-cleanup-generic`
- 必要时与 `10-metadata-fetch` 协同处理元数据文本残留

记录模板：
- 背景：本轮处理的文件、问题来源、影响范围
- 审计变化：修改前后最关键的质量变化
- 高频模式：本轮新增识别出的稳定模式
- 新增规则：放到了哪一层、为什么放这里
- 疑难项：一开始不容易判断、但最终抽象出规则的案例
- 仍需观察：暂时不该泛化、后续继续观察的边界

---

## 2026-04-06 · 第一次非公式清洗沉淀

背景：
- 目标不是继续清 `$...$`，而是把 `out/` 提升到更适合高质量向量化的状态。
- 这一轮集中处理了 4 类问题：HTML 残留、Cell/Elsevier 页眉页脚、Nature reporting summary boilerplate、Europe PMC 摘要里的标签残留。

高频模式：
- `<sup>35</sup>`、`<sup>2, 3</sup>` 这类引用上标没有被转成纯文本。
- `<h4>Background</h4>`、`<h4>Methods</h4>` 被直接塞进 YAML abstract。
- `Cell Stem Cell 33,676–694, April 2, 2026 Cell Stem Cell` 这种页脚被并进正文段落。
- `nature portfolio | reporting summary April 2023`、`Reprints and permissions...` 这类出版流程文本会进入正文。

新增规则：
- `03-mineru-preliminary`
  - 将 MinerU 原始稿中的 `<sup>`、`<sub>`、简单格式标签在初稿阶段就转成纯文本。
  - 原则：原始导出结构噪声应尽早去壳，不要拖到后面的 KB 语义层。
- `07-cleanup-generic`
  - 新增残留 HTML 纯文化规则。
  - 新增已知 publisher boilerplate 与期刊页脚残片移除规则。
  - 增加 `cleanup-apply-inplace.ts`，支持对已有 `out/*.kb.md` 做可重复的非公式就地清洗。
- `10-metadata-fetch`
  - Europe PMC / 本地抽取到的摘要在入 YAML 前先去除 HTML 标签。

疑难项：
- `<sup>1</sup>Zhongshan School of Medicine...`
  - 这类要看上下文决定是机构编号还是正文引用。
  - 最终结论：在 `03-mineru-preliminary` 里按“机构列表 / 普通正文”分流，机构列表转 `¹`，普通正文转 `[1]`。
- `Cell Stem Cell ... Cell Stem Cell` 被嵌入长段落中
  - 这类不是整行噪声，单靠 line filter 清不掉。
  - 需要补“行内 boilerplate 片段剥离”规则，而不是只写整行删除。
- Europe PMC 摘要含 `<h4>Background</h4>`
  - 这不是正文清洗问题，而是元数据入库前的纯文化问题。
  - 结论：在 metadata 层就处理，避免把 HTML 直接写进 YAML。

仍需观察：
- Nature 的 `Reporting Summary` 区块是否应整段删除，目前先做保守的行级/短语级去噪，不直接删除整节。
- 超长 `[表格]` 黏连块目前仍偏粗糙，后续可能需要单独沉淀表格块压缩经验。

---

## 2026-04-06 · 第二次非公式清洗沉淀

背景：
- 第一轮去掉了明显的标签和页脚后，`out` 仍然离“高质量向量化原材料”差半步。
- 主要阻碍不再是脏标签，而是三类更隐蔽的问题：HTML 实体、低价值附录模板区块、跨页超长 `[表格]` 行。

高频模式：
- `&lt;ULN`、`NR &lt; 2.3`、`Fisher&#x27;s exact tests` 这类 HTML 实体仍残留在表格块里。
- `# Reporting Summary`、`# Statistics`、`# Software and code` 这一串 Nature reporting summary 小节信息密度很低，但会明显污染向量检索。
- `# KEY RESOURCES TABLE` 下的资源表经常跨页、续页、混入 `(Continued on next page)` 与大块 catalog 文本，语义价值远低于噪声成本。
- `[表格]` 超长单行一旦跨页，会把“续表标记 + 实体 + 说明语句”糊在同一个 chunk 里。

新增规则：
- `07-cleanup-generic`
  - 新增 HTML 实体解码：`&lt;`、`&gt;`、`&amp;`、`&#x27;` 等转回纯文本。
  - 新增低价值附录模板剥离：整段移除 `Reporting Summary`，并移除 `KEY RESOURCES TABLE` 到 `EXPERIMENTAL MODEL...` 之间的资源表块。
  - 新增表格块规整：去掉续页提示，并在超长 `[表格]` 行里按 `Pt1`、`BCIM1` 这类行首模式切开，减少跨页表格黏连。

疑难项：
- `Reporting Summary` 是否整段删除
  - 单看其中个别句子并不完全“错”，但它们是出版模板，不是论文知识主体。
  - 对向量化来说，这类内容会稀释召回，最终决定按“低价值附录模板”整段移除。
- `KEY RESOURCES TABLE` 是否保留
  - 这类资源表在实验复现上有价值，但对当前知识库的主体检索目标贡献很低，且噪声极高。
  - 当前策略是从标准原材料中移除；若以后要做“复现实验资源库”，再单独保留专用版本。

仍需观察：
- 临床型长表格虽然已做实体解码和续页拆分，但部分表格仍然很长，后续可能要继续细分成“表头 + 分行记录”格式。
- 如果未来知识库明确需要方法学复现能力，`KEY RESOURCES TABLE` 可能要改成“单独导出”为结构化资源，而不是直接删除。

补充修正：
- 单纯把超长 `[表格]` 中的 `Pt1`、`BCIM1` 前面插入换行还不够，因为后面的段落流合并可能把它重新黏回去。
- 更稳妥的做法是插成 `- Pt1 |`、`- BCIM1 |` 这种列表形态，让后续段落整理明确把它们视为独立行。
- 另外，很多 PDF 导出会把行号混入正文，如 `# 617 Data and code availability`、`619 at NCBI...`。
  - 这类 3-4 位前缀数字通常不是语义内容，而是版面行号，应在通用清洗层去掉。
- 图版和补充图页面还会残留极短的面板碎片，如 `kb`、`kb a b`、`C d e f g`、带 `(kDa)` 的短标签行。
  - 这类短行的共同点是：词很短、信息密度极低、缺少句法结构。
  - 可以用保守的“短碎片面板噪声”规则删除，但不要把正常缩写行一并误杀。
