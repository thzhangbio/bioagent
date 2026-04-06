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
