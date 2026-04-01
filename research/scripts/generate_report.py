import json
import os
from collections import Counter, defaultdict

src = "医学编辑岗-苏州-整理/全量结构化数据.json"
with open(src, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"总记录数: {len(data)}")

duty_type_counter = Counter()
deliverable_counter = Counter()
input_source_counter = Counter()
ai_replace_counter = Counter()
hard_skill_counter = Counter()
soft_skill_counter = Counter()
tool_counter = Counter()
lang_counter = Counter()
work_mode_counter = Counter()
domain_counter = Counter()
depth_counter = Counter()

salary_records = []
edu_counter = Counter()
exp_counter = Counter()
industry_counter = Counter()

ai_high_duties = []
ai_low_duties = []

total_duties = 0

for record in data:
    base = record.get("基础信息", {})

    sal = base.get("薪资", "")
    if sal:
        salary_records.append(sal)

    edu = base.get("学历要求", "")
    if edu:
        edu_counter[edu] += 1

    exp = base.get("经验要求", "")
    if exp:
        exp_counter[exp] += 1

    company_info = record.get("公司信息", {})
    industry = company_info.get("所属行业", "")
    if industry:
        short_industry = industry.split("（")[0].split("(")[0].strip()
        if short_industry:
            industry_counter[short_industry] += 1

    duties = record.get("核心职责", [])
    total_duties += len(duties)

    for duty in duties:
        dtype = duty.get("职责类型", "")
        for t in dtype.split("/"):
            t = t.strip()
            if t:
                duty_type_counter[t] += 1

        for d in duty.get("具体交付物", []):
            deliverable_counter[d.strip()] += 1

        for s in duty.get("输入源", []):
            input_source_counter[s.strip()] += 1

        ai_level = duty.get("AI可替代性", "")
        if ai_level:
            ai_replace_counter[ai_level] += 1

        if ai_level == "高":
            ai_high_duties.append({
                "公司": record["公司名"],
                "职位": record["职位名"],
                "职责": duty.get("职责原文", ""),
                "理由": duty.get("AI可替代性理由", "")
            })
        elif ai_level == "低":
            ai_low_duties.append({
                "公司": record["公司名"],
                "职位": record["职位名"],
                "职责": duty.get("职责原文", ""),
                "理由": duty.get("AI可替代性理由", "")
            })

    skills = record.get("技能要求", {})
    for s in skills.get("硬技能", []):
        hard_skill_counter[s.strip()] += 1
    for s in skills.get("软技能", []):
        soft_skill_counter[s.strip()] += 1
    for s in skills.get("工具要求", []):
        tool_counter[s.strip()] += 1
    for s in skills.get("语言要求", []):
        lang_counter[s.strip()] += 1

    for m in record.get("工作模式", []):
        work_mode_counter[m.strip()] += 1

    domain_info = record.get("领域信息", {})
    for d in domain_info.get("涉及领域", []):
        domain_counter[d.strip()] += 1
    depth = domain_info.get("专业深度", "")
    if depth:
        depth_counter[depth] += 1


report = []
report.append("# 医学编辑岗位深度分析报告")
report.append(f"\n> 数据来源：57 份苏州及周边地区医学编辑岗位招聘信息")
report.append(f"> 分析方式：LLM 语义级结构化提取（非 Regex 关键词匹配）")
report.append(f"> 总计提取核心职责条目：{total_duties} 条")
report.append("")

report.append("---")
report.append("")
report.append("## 一、AI 可替代性全局评估")
report.append("")
total_ai = sum(ai_replace_counter.values())
for level in ["高", "中", "低"]:
    cnt = ai_replace_counter.get(level, 0)
    pct = cnt / total_ai * 100 if total_ai else 0
    bar = "█" * int(pct / 2)
    report.append(f"- **{level}** 可替代性：{cnt} 条职责 ({pct:.1f}%) {bar}")

report.append("")
report.append("### 高 AI 可替代性的职责 TOP 示例")
report.append("")
seen_high = set()
for item in ai_high_duties[:15]:
    key = item["职责"][:30]
    if key not in seen_high:
        seen_high.add(key)
        report.append(f"- [{item['公司']}] {item['职责'][:80]}")
        report.append(f"  - 理由：{item['理由']}")

report.append("")
report.append("### 低 AI 可替代性的职责 TOP 示例")
report.append("")
seen_low = set()
for item in ai_low_duties[:15]:
    key = item["职责"][:30]
    if key not in seen_low:
        seen_low.add(key)
        report.append(f"- [{item['公司']}] {item['职责'][:80]}")
        report.append(f"  - 理由：{item['理由']}")

report.append("")
report.append("---")
report.append("")
report.append("## 二、职责类型分布")
report.append("")
for dtype, cnt in duty_type_counter.most_common(20):
    bar = "█" * (cnt // 2)
    report.append(f"| {dtype} | {cnt} 次 | {bar} |")

report.append("")
report.append("---")
report.append("")
report.append("## 三、交付物清单（按频率排序）")
report.append("")
report.append("| 交付物 | 出现次数 |")
report.append("|--------|---------|")
for d, cnt in deliverable_counter.most_common(40):
    report.append(f"| {d} | {cnt} |")

report.append("")
report.append("---")
report.append("")
report.append("## 四、输入源清单（按频率排序）")
report.append("")
report.append("| 输入源 | 出现次数 |")
report.append("|--------|---------|")
for s, cnt in input_source_counter.most_common(30):
    report.append(f"| {s} | {cnt} |")

report.append("")
report.append("---")
report.append("")
report.append("## 五、技能需求分析")
report.append("")
report.append("### 硬技能 TOP 20")
report.append("")
for s, cnt in hard_skill_counter.most_common(20):
    report.append(f"- {s} ({cnt})")

report.append("")
report.append("### 软技能 TOP 15")
report.append("")
for s, cnt in soft_skill_counter.most_common(15):
    report.append(f"- {s} ({cnt})")

report.append("")
report.append("### 工具要求")
report.append("")
for s, cnt in tool_counter.most_common(15):
    report.append(f"- {s} ({cnt})")

report.append("")
report.append("### 语言要求")
report.append("")
for s, cnt in lang_counter.most_common(10):
    report.append(f"- {s} ({cnt})")

report.append("")
report.append("---")
report.append("")
report.append("## 六、工作模式分布")
report.append("")
for m, cnt in work_mode_counter.most_common():
    report.append(f"- {m} ({cnt})")

report.append("")
report.append("---")
report.append("")
report.append("## 七、领域分布")
report.append("")
report.append("| 领域 | 出现次数 |")
report.append("|------|---------|")
for d, cnt in domain_counter.most_common():
    report.append(f"| {d} | {cnt} |")

report.append("")
report.append("### 专业深度要求分布")
report.append("")
for d, cnt in depth_counter.most_common():
    report.append(f"- {d} ({cnt})")

report.append("")
report.append("---")
report.append("")
report.append("## 八、基础画像")
report.append("")
report.append("### 学历要求")
report.append("")
for e, cnt in edu_counter.most_common():
    report.append(f"- {e} ({cnt})")

report.append("")
report.append("### 经验要求")
report.append("")
for e, cnt in exp_counter.most_common():
    report.append(f"- {e} ({cnt})")

report.append("")
report.append("### 行业分布（去重简化）")
report.append("")
for ind, cnt in industry_counter.most_common(15):
    report.append(f"- {ind} ({cnt})")

report.append("")
report.append("---")
report.append("")
report.append("## 九、下一步行动建议")
report.append("")
report.append("基于以上分析，建议按以下优先级推进 AI 医学编辑 Agent 的建设：")
report.append("")

high_pct = ai_replace_counter.get("高", 0) / total_ai * 100 if total_ai else 0
mid_pct = ai_replace_counter.get("中", 0) / total_ai * 100 if total_ai else 0

report.append(f"1. **首先攻克高可替代性职责** ({high_pct:.0f}%)：这些是 AI 能直接胜任的任务，建成后立刻产生价值")
report.append(f"2. **其次辅助中可替代性职责** ({mid_pct:.0f}%)：AI 提供初稿/建议，人类做最终把关")
report.append(f"3. **低可替代性职责保留给人类**，但 AI 可提供信息支持和流程自动化")
report.append("")
report.append("### 建议的 Agent Workflow 优先级")
report.append("")

top_deliverables = deliverable_counter.most_common(8)
for i, (d, cnt) in enumerate(top_deliverables, 1):
    report.append(f"{i}. **{d}** (覆盖 {cnt} 条职责)")

output_path = "医学编辑岗-苏州-整理/深度分析报告.md"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report))

print(f"报告已生成: {output_path}")
print(f"文件大小: {os.path.getsize(output_path) / 1024:.1f} KB")
