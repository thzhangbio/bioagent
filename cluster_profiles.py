import json

with open("医学编辑岗-苏州-整理/全量结构化数据.json", "r", encoding="utf-8") as f:
    data = json.load(f)

profiles = []
for r in data:
    duty_types = {}
    deliverables = []
    ai_levels = {"高": 0, "中": 0, "低": 0}

    for d in r.get("核心职责", []):
        for t in d.get("职责类型", "").split("/"):
            t = t.strip()
            if t:
                duty_types[t] = duty_types.get(t, 0) + 1
        deliverables.extend(d.get("具体交付物", []))
        level = d.get("AI可替代性", "")
        if level in ai_levels:
            ai_levels[level] += 1

    sorted_types = sorted(duty_types.items(), key=lambda x: -x[1])
    top_types = [f"{t}({c})" for t, c in sorted_types[:4]]

    domains = r.get("领域信息", {}).get("涉及领域", [])
    modes = r.get("工作模式", [])
    depth = r.get("领域信息", {}).get("专业深度", "")

    total = sum(ai_levels.values())
    ai_str = f"高{ai_levels['高']}/中{ai_levels['中']}/低{ai_levels['低']}" if total > 0 else "无"

    profile = {
        "序号": r["序号"],
        "公司": r["公司名"],
        "职位": r["职位名"],
        "薪资": r.get("基础信息", {}).get("薪资", ""),
        "主要职责类型": top_types,
        "交付物": deliverables[:8],
        "领域": domains,
        "工作模式": modes[:4],
        "专业深度": depth,
        "AI可替代性分布": ai_str
    }
    profiles.append(profile)

with open("医学编辑岗-苏州-整理/聚类特征摘要.json", "w", encoding="utf-8") as f:
    json.dump(profiles, f, ensure_ascii=False, indent=2)

for p in profiles:
    types_str = ", ".join(p["主要职责类型"])
    domains_str = ", ".join(p["领域"][:3]) if p["领域"] else "未标注"
    delivs = ", ".join(p["交付物"][:4]) if p["交付物"] else "无"
    print(f"{p['序号']}|{p['公司'][:12]}|{p['职位'][:10]}|{types_str}|{domains_str}|{delivs}|{p['AI可替代性分布']}")
