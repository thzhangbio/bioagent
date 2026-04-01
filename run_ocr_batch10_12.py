import easyocr
import os

reader = easyocr.Reader(['ch_sim', 'en'])
files = [
    'Screenshot_2026-04-01-12-59-06-10.jpg',
    'Screenshot_2026-04-01-12-59-14-39_30c758e9585c2890bbdc56e1d8daeadd.jpg',
    'Screenshot_2026-04-01-12-59-43-58.jpg',
    'Screenshot_2026-04-01-12-59-59-96.jpg',
    'Screenshot_2026-04-01-13-00-20-38.jpg',
    'Screenshot_2026-04-01-13-00-45-42.jpg',
    'Screenshot_2026-04-01-13-00-55-98_30c758e9585c2890bbdc56e1d8daeadd.jpg',
    'Screenshot_2026-04-01-13-01-16-99.jpg',
    'Screenshot_2026-04-01-13-01-41-68.jpg',
    'Screenshot_2026-04-01-13-01-57-05.jpg',
    'Screenshot_2026-04-01-13-02-23-59.jpg',
    'Screenshot_2026-04-01-13-03-02-59.jpg'
]

for f in files:
    print(f"=== START {f} ===")
    path = os.path.join('医学编辑岗-苏州招聘', f)
    result = reader.readtext(path, detail=0)
    print('\n'.join(result))
    print(f"=== END {f} ===\n")
