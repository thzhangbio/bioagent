# Segment: links -> inbox

本段负责：

- 读取 `links.txt`
- 抓取微信公众号 raw HTML
- 按公众号来源策略决定是否写入 `inbox/`

后续可继续细分为：

- `00-read-links/`
- `01-fetch-raw/`
- `02-source-gating/`
- `03-write-inbox/`
