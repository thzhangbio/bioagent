import os
import shutil

dst_dir = "医学编辑岗-苏州-整理"

# 修复未知公司的文件
fixes = {
    "04-未知公司-医学编辑.md": "04-苏州大学附属儿童医院-医学编辑.md",
    "07-未知公司-医学编辑.md": "07-亿航生物-医学编辑.md",
    "45-未知公司-生物医学科研编辑.md": "45-山东赛捷医学-生物医学科研编辑.md",
    "46-未知公司-(急招)科普内容编辑.md": "46-大禹网络-(急招)科普内容编辑.md"
}

for old_name, new_name in fixes.items():
    old_path = os.path.join(dst_dir, old_name)
    new_path = os.path.join(dst_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        print(f"Fixed: {old_name} -> {new_name}")

