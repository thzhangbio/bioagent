import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-43-39-23.jpg',
    'Screenshot_2026-04-01-12-43-59-92.jpg',
    'Screenshot_2026-04-01-12-44-14-82.jpg',
    'Screenshot_2026-04-01-12-45-03-23.jpg',
    'Screenshot_2026-04-01-12-45-28-32.jpg',
    'Screenshot_2026-04-01-12-45-42-13.jpg',
    'Screenshot_2026-04-01-12-45-55-89.jpg',
    'Screenshot_2026-04-01-12-46-12-37.jpg',
    'Screenshot_2026-04-01-12-46-33-12_30c758e9585c2890bbdc56e1d8daeadd.jpg',
    'Screenshot_2026-04-01-12-47-02-23.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
