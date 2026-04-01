import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-39-24-97.jpg',
    'Screenshot_2026-04-01-12-40-05-18.jpg',
    'Screenshot_2026-04-01-12-40-51-07.jpg',
    'Screenshot_2026-04-01-12-41-36-74.jpg',
    'Screenshot_2026-04-01-12-42-03-98.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
