# Segment: load -> normalized

本段负责：

- 根据 `source` 选择输入来源
- 读取输入目录中的文件
- 解析基础元数据
- 统一生成 `ImportDocument`

根总控：

- `segment-load-to-normalized.ts`

后续可继续细分为：

- `00-source-routing/`
- `01-read-input/`
- `02-parse-frontmatter/`
- `03-build-import-documents/`
- `04-normalize-metadata/`
