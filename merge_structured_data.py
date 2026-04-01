import json
import os
import glob

src_dir = "医学编辑岗-苏州-整理"
batch_files = sorted(glob.glob(os.path.join(src_dir, "structured_batch_*.json")))

all_records = []
for bf in batch_files:
    with open(bf, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, list):
            all_records.extend(data)
        else:
            all_records.append(data)
    print(f"已加载: {os.path.basename(bf)} -> {len(data)} 条记录")

all_records.sort(key=lambda x: int(x.get("序号", "0")))

print(f"\n总计: {len(all_records)} 条记录")

missing = []
seen = set()
for r in all_records:
    num = int(r.get("序号", 0))
    seen.add(num)
for i in range(1, 58):
    if i not in seen:
        missing.append(i)

if missing:
    print(f"缺失序号: {missing}")
else:
    print("所有 57 条记录完整，无遗漏")

total_duties = 0
for r in all_records:
    duties = r.get("核心职责", [])
    total_duties += len(duties)
    if len(duties) == 0:
        print(f"  警告: 序号 {r['序号']} ({r['公司名']}) 没有提取到核心职责")

print(f"总计提取核心职责条目: {total_duties} 条")
print(f"平均每个岗位: {total_duties/len(all_records):.1f} 条职责")

output_path = os.path.join(src_dir, "全量结构化数据.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_records, f, ensure_ascii=False, indent=2)

print(f"\n已输出到: {output_path}")
print(f"文件大小: {os.path.getsize(output_path) / 1024:.1f} KB")
