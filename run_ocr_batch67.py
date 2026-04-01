import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-47-22-48.jpg',
    'Screenshot_2026-04-01-12-47-38-40.jpg',
    'Screenshot_2026-04-01-12-47-54-78.jpg',
    'Screenshot_2026-04-01-12-48-09-51.jpg',
    'Screenshot_2026-04-01-12-48-22-96.jpg',
    'Screenshot_2026-04-01-12-48-40-76.jpg',
    'Screenshot_2026-04-01-12-49-04-56.jpg',
    'Screenshot_2026-04-01-12-49-34-86.jpg',
    'Screenshot_2026-04-01-12-49-57-13.jpg',
    'Screenshot_2026-04-01-12-50-23-81_30c758e9585c2890bbdc56e1d8daeadd.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
