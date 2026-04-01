import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-51-28-19.jpg',
    'Screenshot_2026-04-01-12-51-51-22.jpg',
    'Screenshot_2026-04-01-12-52-15-49.jpg',
    'Screenshot_2026-04-01-12-53-11-45.jpg',
    'Screenshot_2026-04-01-12-56-30-60.jpg',
    'Screenshot_2026-04-01-12-56-55-71.jpg',
    'Screenshot_2026-04-01-12-57-35-88.jpg',
    'Screenshot_2026-04-01-12-57-59-74.jpg',
    'Screenshot_2026-04-01-12-58-20-41.jpg',
    'Screenshot_2026-04-01-12-58-44-56.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
