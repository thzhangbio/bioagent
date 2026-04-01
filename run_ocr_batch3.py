import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-42-19-08.jpg',
    'Screenshot_2026-04-01-12-42-35-61.jpg',
    'Screenshot_2026-04-01-12-42-50-75.jpg',
    'Screenshot_2026-04-01-12-43-06-58.jpg',
    'Screenshot_2026-04-01-12-43-26-13.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
