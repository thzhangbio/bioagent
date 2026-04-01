import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-37-49-77.jpg',
    'Screenshot_2026-04-01-12-38-49-31.jpg',
    'Screenshot_2026-04-01-12-38-55-25_30c758e9585c2890bbdc56e1d8daeadd.jpg',
    'Screenshot_2026-04-01-12-39-10-25.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
