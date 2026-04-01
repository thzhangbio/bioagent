import os
import shutil
import re

src_dir = "医学编辑岗-苏州-原始数据"
dst_dir = "医学编辑岗-苏州-整理"

if not os.path.exists(dst_dir):
    os.makedirs(dst_dir)

files = [f for f in os.listdir(src_dir) if f.endswith('.md') and f != '转换进度追踪.md']
files.sort()

for idx, filename in enumerate(files, 1):
    filepath = os.path.join(src_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]
    
    if not lines:
        continue
        
    job_title = lines[0]
    # 净化文件名，去除不合法字符
    job_title = re.sub(r'[\\/*?:"<>|]', '_', job_title)
    
    company_name = "未知公司"
    # 倒序查找包含公司规模的行，其上一行通常是公司名称
    for i in range(len(lines)-1, 0, -1):
        if '人 · ' in lines[i] or '人 ` ' in lines[i] or re.search(r'\d+-\d+人', lines[i]) or re.search(r'\d+人以上', lines[i]) or '人' in lines[i] and ('轮' in lines[i] or '融资' in lines[i] or '上市' in lines[i]):
            company_name = lines[i-1]
            break
            
    # 如果没找到，尝试找倒数第二行或第三行较长的文本作为公司名
    if company_name == "未知公司":
        for i in range(len(lines)-1, max(-1, len(lines)-5), -1):
            if "公司" in lines[i] or "医院" in lines[i] or "中心" in lines[i]:
                company_name = lines[i]
                break
    
    company_name = re.sub(r'[\\/*?:"<>|]', '_', company_name)
    
    new_filename = f"{idx:02d}-{company_name}-{job_title}.md"
    
    src_path = os.path.join(src_dir, filename)
    dst_path = os.path.join(dst_dir, new_filename)
    shutil.copy2(src_path, dst_path)
    print(f"Copied: {filename} -> {new_filename}")

print("All files copied and renamed successfully.")
