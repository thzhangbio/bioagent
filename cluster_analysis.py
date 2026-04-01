import json

with open("医学编辑岗-苏州-整理/全量结构化数据.json", "r", encoding="utf-8") as f:
    data = json.load(f)

clusters = {
    "A": {
        "name": "临床医学写作 (Clinical Medical Writing)",
        "ids": ["03", "06", "08", "18", "23", "28", "30", "37", "43", "47", "49", "51"],
        "description": "核心工作围绕临床试验文档撰写、法规文件编写、临床方案设计",
        "core_deliverables": "临床试验方案、研究者手册、CRF/病例报告表、知情同意书、综述、总结报告、IND申报文件",
        "typical_companies": "CRO公司（泰格、科林利康）、药企、临床研究机构",
        "ai_summary": "中-低可替代：文献检索和初稿可AI化，但方案设计和专家沟通需深厚临床知识"
    },
    "B": {
        "name": "学术论文/SCI编辑 (Academic & SCI Editing)",
        "ids": ["09", "10", "11", "16", "19", "22", "24", "25", "34", "35", "38", "41", "42", "45"],
        "description": "核心工作围绕SCI论文写作与编辑、学术审稿、数据分析、文献综述、课题设计",
        "core_deliverables": "SCI论文、论文审稿意见、文献综述、数据分析报告、课题设计方案、科研调研报告",
        "typical_companies": "学术服务公司（梅斯、善木、迪美格）、科研外包机构",
        "ai_summary": "中-高可替代：数据分析和文献检索高度可替代，论文润色和翻译可AI化，但终审把关和课题创新需人工"
    },
    "C": {
        "name": "医学推广/会务支持 (Medical Affairs & MSL)",
        "ids": ["01", "07", "13", "14", "15", "17", "20", "21", "29", "33", "39", "40", "44", "48", "50", "53", "55"],
        "description": "核心工作围绕医学推广物料制作、学术会议支持、客户学术沟通、培训体系搭建",
        "core_deliverables": "PPT/幻灯、DA(产品提示物)、会议新闻稿、产品宣传资料、学术推广物料、培训课件、文献翻译/综述",
        "typical_companies": "医药咨询公司（坤为、洞察力）、医疗器械公司、药企市场部",
        "ai_summary": "中可替代：物料初稿可AI生成（PPT框架、文献综述），但客户沟通、策略制定、学术会议现场支持需人工"
    },
    "D": {
        "name": "新媒体/内容运营 (Content Marketing & Digital)",
        "ids": ["02", "04", "05", "12", "26", "27", "31", "32", "36", "46", "52", "54", "56", "57"],
        "description": "核心工作围绕公众号运营、科普内容创作、品牌传播、视频内容、AIGC应用",
        "core_deliverables": "公众号推文、科普文章、视频脚本、品牌物料、短视频、新媒体运营数据分析",
        "typical_companies": "互联网医疗公司、医疗科技公司、教育机构、医疗器械市场部",
        "ai_summary": "高可替代：内容批量生产、数据分析、选题策划、SEO优化均可AI化，是AI落地的最佳突破口"
    }
}

record_map = {r["序号"]: r for r in data}

report = []
report.append("# 医学编辑岗位聚类分析报告")
report.append("")
report.append("> 基于 57 份岗位的 235 条核心职责进行语义聚类")
report.append("")

report.append("## 聚类总览")
report.append("")
report.append("| 聚类 | 角色原型 | 岗位数量 | AI可替代性 |")
report.append("|------|---------|---------|-----------|")
for cid in ["A", "B", "C", "D"]:
    c = clusters[cid]
    report.append(f"| {cid} | {c['name']} | {len(c['ids'])} | {c['ai_summary'][:20]}... |")

report.append("")
report.append("---")

for cid in ["A", "B", "C", "D"]:
    c = clusters[cid]
    ids = c["ids"]
    report.append("")
    report.append(f"## 聚类 {cid}：{c['name']}")
    report.append("")
    report.append(f"**定位**：{c['description']}")
    report.append("")
    report.append(f"**核心交付物**：{c['core_deliverables']}")
    report.append("")
    report.append(f"**典型雇主**：{c['typical_companies']}")
    report.append("")
    report.append(f"**AI 可替代性评估**：{c['ai_summary']}")
    report.append("")

    ai_h, ai_m, ai_l = 0, 0, 0
    all_duty_types = {}
    all_deliverables = {}
    salary_list = []

    report.append(f"### 包含岗位（{len(ids)} 个）")
    report.append("")
    report.append("| 序号 | 公司 | 职位 | 薪资 | AI可替代分布 |")
    report.append("|------|------|------|------|-------------|")

    for sid in ids:
        r = record_map.get(sid)
        if not r:
            continue

        h, m, l = 0, 0, 0
        for duty in r.get("核心职责", []):
            level = duty.get("AI可替代性", "")
            if level == "高":
                h += 1
                ai_h += 1
            elif level == "中":
                m += 1
                ai_m += 1
            elif level == "低":
                l += 1
                ai_l += 1

            for t in duty.get("职责类型", "").split("/"):
                t = t.strip()
                if t:
                    all_duty_types[t] = all_duty_types.get(t, 0) + 1

            for d in duty.get("具体交付物", []):
                d = d.strip()
                all_deliverables[d] = all_deliverables.get(d, 0) + 1

        sal = r.get("基础信息", {}).get("薪资", "")
        company = r["公司名"][:15]
        report.append(f"| {sid} | {company} | {r['职位名'][:12]} | {sal} | 高{h}/中{m}/低{l} |")

    total = ai_h + ai_m + ai_l
    report.append("")
    report.append(f"### 聚类 {cid} AI 可替代性汇总")
    report.append("")
    if total > 0:
        report.append(f"- 高：{ai_h} 条 ({ai_h/total*100:.0f}%)")
        report.append(f"- 中：{ai_m} 条 ({ai_m/total*100:.0f}%)")
        report.append(f"- 低：{ai_l} 条 ({ai_l/total*100:.0f}%)")

    report.append("")
    report.append(f"### 聚类 {cid} 职责类型 TOP 5")
    report.append("")
    sorted_types = sorted(all_duty_types.items(), key=lambda x: -x[1])
    for t, cnt in sorted_types[:5]:
        report.append(f"- {t} ({cnt})")

    report.append("")
    report.append(f"### 聚类 {cid} 高频交付物 TOP 8")
    report.append("")
    sorted_delivs = sorted(all_deliverables.items(), key=lambda x: -x[1])
    for d, cnt in sorted_delivs[:8]:
        report.append(f"- {d} ({cnt})")

    report.append("")
    report.append("---")

report.append("")
report.append("## 四类角色的 AI Agent 建设优先级")
report.append("")
report.append("| 优先级 | 聚类 | 理由 |")
report.append("|-------|------|------|")
report.append("| **P0 最高** | D-新媒体/内容运营 | AI可替代性最高，内容批量生产场景明确，ROI最大 |")
report.append("| **P1 高** | B-学术论文/SCI编辑 | 数据分析+文献检索+论文润色组合高度可AI化，市场需求大 |")
report.append("| **P2 中** | C-医学推广/会务支持 | 物料初稿可AI化，但需要大量客户交互，适合人机协作模式 |")
report.append("| **P3 低** | A-临床医学写作 | 专业壁垒最高，法规风险大，需要最深的领域知识和人工把关 |")
report.append("")
report.append("### 建议的切入策略")
report.append("")
report.append("**第一阶段：D类 Agent — 「AI 内容工厂」**")
report.append("- 输入：热点话题/产品关键词/目标受众")
report.append("- 输出：公众号推文、科普文章、短视频脚本")
report.append("- 能力：选题策划 → 素材收集 → 初稿生成 → SEO优化 → 排版输出")
report.append("- 估计覆盖率：80%+ 的D类岗位工作量")
report.append("")
report.append("**第二阶段：B类 Agent — 「AI 学术助手」**")
report.append("- 输入：研究方向/数据集/目标期刊")
report.append("- 输出：文献综述、数据分析报告、SCI论文初稿、润色建议")
report.append("- 能力：文献检索 → 数据分析 → 论文框架 → 初稿撰写 → 语言润色")
report.append("- 估计覆盖率：60-70% 的B类岗位工作量")
report.append("")
report.append("**第三阶段：C类 Agent — 「AI 医学推广助手」**")
report.append("- 输入：产品Brief/会议信息/文献资料")
report.append("- 输出：PPT框架、DA初稿、会议新闻稿、培训材料")
report.append("- 能力：文献整理 → 要点提炼 → 物料初稿 → 格式适配")
report.append("- 估计覆盖率：50-60% 的C类岗位工作量（剩余需人工客户沟通）")
report.append("")
report.append("**第四阶段：A类 Agent — 「AI 临床写作辅助」**")
report.append("- 输入：临床试验方案要素/法规模板/既往案例")
report.append("- 输出：方案初稿、CRF模板、研究者手册框架")
report.append("- 能力：模板填充 → 法规合规检查 → 初稿生成（需强力人工审核）")
report.append("- 估计覆盖率：30-40% 的A类岗位工作量（法规风险高，需严格人审）")

cluster_output = {}
for cid in ["A", "B", "C", "D"]:
    c = clusters[cid]
    cluster_output[cid] = {
        "name": c["name"],
        "description": c["description"],
        "positions": []
    }
    for sid in c["ids"]:
        r = record_map.get(sid)
        if r:
            cluster_output[cid]["positions"].append({
                "序号": sid,
                "公司": r["公司名"],
                "职位": r["职位名"]
            })

with open("医学编辑岗-苏州-整理/聚类结果.json", "w", encoding="utf-8") as f:
    json.dump(cluster_output, f, ensure_ascii=False, indent=2)

output_path = "医学编辑岗-苏州-整理/聚类分析报告.md"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report))

print(f"聚类分析报告: {output_path}")
print(f"聚类结果JSON: 医学编辑岗-苏州-整理/聚类结果.json")
print()
for cid in ["A", "B", "C", "D"]:
    c = clusters[cid]
    print(f"聚类 {cid}: {c['name']} — {len(c['ids'])} 个岗位")
print(f"\n合计: {sum(len(c['ids']) for c in clusters.values())} 个岗位")
