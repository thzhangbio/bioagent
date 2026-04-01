import os
import csv
import re

src_dir = "医学编辑岗-苏州-整理"

files = sorted([f for f in os.listdir(src_dir) if f.endswith('.md')])

rows = []

for filename in files:
    filepath = os.path.join(src_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    # 从文件名提取序号、公司、职位
    match = re.match(r'(\d+)-(.+?)-(.+)\.md', filename)
    if match:
        idx = match.group(1)
        company = match.group(2)
        job_title = match.group(3)
    else:
        idx, company, job_title = "?", "?", "?"
    
    # 薪资 - 通常在第2行
    salary = lines[1] if len(lines) > 1 else ""
    
    # 地点 - 通常在第3行
    location = lines[2] if len(lines) > 2 else ""
    
    # 经验和学历 - 通常在第3-5行
    experience = ""
    education = ""
    for line in lines[2:6]:
        if re.search(r'\d+-\d+年|经验不限|在校|1年以上', line):
            experience = line
        if re.search(r'本科|硕士|博士|大专|学历不限', line):
            if not education:
                education = line
    
    # 公司规模和行业
    company_scale = ""
    company_industry = ""
    for line in lines:
        if re.search(r'\d+-\d+人|0-20人|1000-9999人', line):
            company_scale = line
            break
    
    # 提取岗位职责和任职要求的原文
    duties = []
    requirements = []
    
    full_text = content
    
    # 提取所有具体的工作交付物关键词
    deliverables = []
    kw_map = {
        'PPT/幻灯': r'PPT|幻灯|宣讲',
        'DA(产品提示物)': r'\bDA\b|产品提示物',
        '公众号/推文': r'公众号|推文|软文|新媒体',
        'SCI论文': r'SCI|论文|paper',
        '临床方案/报告': r'临床试验方案|临床总结报告|CRF|研究者手册|知情同意|CSR|IB|IND',
        '文献检索/翻译': r'文献检索|文献.*翻译|PubMed|检索.*文献',
        '学术会议/报道': r'学术会议|会议.*报道|会议新闻稿|学术推广',
        '科普文章': r'科普|患者教育|患教',
        '数据分析/统计': r'数据.*分析|统计分析|数据清理|数据整理',
        '视频脚本': r'视频.*脚本|短视频|直播',
        '标书/课题设计': r'标书|课题.*设计|课题.*申报|基金申请',
        '产品宣传资料': r'宣传.*资料|产品.*资料|宣传海报|使用手册|品牌',
        '文献综述/解读': r'文献.*综述|文献.*解读|文献回顾',
        '审核/校对': r'审核|校对|审稿|终审|审校',
        '翻译(中英)': r'翻译|英文.*写作|英文.*编辑|润色',
    }
    
    found_deliverables = []
    for label, pattern in kw_map.items():
        if re.search(pattern, full_text):
            found_deliverables.append(label)
    
    # 提取核心技能要求关键词
    skill_map = {
        '英语六级+': r'六级|CET-6|英语.*六',
        '英语四级+': r'四级|CET-4',
        'GCP知识': r'GCP|临床试验.*法规',
        'Office办公': r'OFFICE|PPT.*WORD|办公软件',
        '医学文献检索': r'文献检索|PubMed|Web of Science|知网|万方',
        '统计/作图软件': r'统计软件|作图|SPSS|R语言|数据可视化',
        'SCI写作经验': r'SCI.*写作|SCI.*发表|SCI.*论文',
        '新媒体运营': r'公众号运营|新媒体|小红书|抖音',
        'AI工具': r'AI|AIGC|ChatGPT|大模型|Prompt',
    }
    
    found_skills = []
    for label, pattern in skill_map.items():
        if re.search(pattern, full_text, re.IGNORECASE):
            found_skills.append(label)
    
    # 提取疾病/产品领域
    domain_map = {
        '肿瘤': r'肿瘤|癌症|抗肿瘤',
        '心血管': r'心血管|心内科|心外科',
        '免疫': r'免疫|自身免疫',
        '外泌体': r'外泌体',
        '医疗器械': r'医疗器械|IVD',
        '临床试验/CRO': r'临床试验|CRO|CRF|GCP',
        '生物制药': r'生物.*制药|创新药|仿制药',
        '营养学': r'营养',
    }
    
    found_domains = []
    for label, pattern in domain_map.items():
        if re.search(pattern, full_text):
            found_domains.append(label)
    
    rows.append({
        '序号': idx,
        '公司名': company,
        '职位名': job_title,
        '薪资': salary,
        '工作地点': location,
        '经验要求': experience,
        '学历要求': education,
        '公司规模/行业': company_scale,
        '涉及交付物': ' | '.join(found_deliverables),
        '技能要求': ' | '.join(found_skills),
        '涉及领域': ' | '.join(found_domains),
    })

# 写入CSV
output_path = "医学编辑岗-苏州-整理/岗位结构化数据汇总.csv"
fieldnames = ['序号', '公司名', '职位名', '薪资', '工作地点', '经验要求', '学历要求', '公司规模/行业', '涉及交付物', '技能要求', '涉及领域']

with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"CSV已生成: {output_path}")
print(f"共处理 {len(rows)} 条记录")

# ============ 统计分析 ============
print("\n" + "="*60)
print("【交付物频率统计 - 这些就是 AI 员工需要学会的核心任务】")
print("="*60)

from collections import Counter

all_deliverables = []
for r in rows:
    if r['涉及交付物']:
        all_deliverables.extend(r['涉及交付物'].split(' | '))

del_counter = Counter(all_deliverables)
for item, count in del_counter.most_common():
    bar = '█' * count
    print(f"  {item:<20s} {count:>3d}次 ({count*100//len(rows):>2d}%) {bar}")

print("\n" + "="*60)
print("【技能要求频率统计 - AI 员工需要具备的能力】")
print("="*60)

all_skills = []
for r in rows:
    if r['技能要求']:
        all_skills.extend(r['技能要求'].split(' | '))

skill_counter = Counter(all_skills)
for item, count in skill_counter.most_common():
    bar = '█' * count
    print(f"  {item:<20s} {count:>3d}次 ({count*100//len(rows):>2d}%) {bar}")

print("\n" + "="*60)
print("【涉及领域频率统计 - AI 员工需要掌握的专业方向】")
print("="*60)

all_domains = []
for r in rows:
    if r['涉及领域']:
        all_domains.extend(r['涉及领域'].split(' | '))

domain_counter = Counter(all_domains)
for item, count in domain_counter.most_common():
    bar = '█' * count
    print(f"  {item:<20s} {count:>3d}次 ({count*100//len(rows):>2d}%) {bar}")

print("\n" + "="*60)
print("【薪资分布统计】")
print("="*60)

salary_ranges = []
for r in rows:
    s = r['薪资']
    match = re.search(r'(\d+)-(\d+)', s)
    if match:
        low = int(match.group(1))
        high = int(match.group(2))
        salary_ranges.append((low, high))

if salary_ranges:
    avg_low = sum(s[0] for s in salary_ranges) / len(salary_ranges)
    avg_high = sum(s[1] for s in salary_ranges) / len(salary_ranges)
    min_low = min(s[0] for s in salary_ranges)
    max_high = max(s[1] for s in salary_ranges)
    print(f"  样本数: {len(salary_ranges)} 个职位")
    print(f"  薪资下限均值: {avg_low:.1f}K")
    print(f"  薪资上限均值: {avg_high:.1f}K")
    print(f"  最低薪资: {min_low}K")
    print(f"  最高薪资: {max_high}K")

print("\n" + "="*60)
print("【学历要求分布】")
print("="*60)

edu_counter = Counter()
for r in rows:
    edu = r['学历要求']
    if '博士' in edu:
        edu_counter['博士'] += 1
    elif '硕士' in edu:
        edu_counter['硕士'] += 1
    elif '本科' in edu:
        edu_counter['本科'] += 1
    elif '大专' in edu:
        edu_counter['大专'] += 1
    else:
        edu_counter['其他/不限'] += 1

for item, count in edu_counter.most_common():
    bar = '█' * count
    print(f"  {item:<10s} {count:>3d}个 ({count*100//len(rows):>2d}%) {bar}")

