# Segment: chunks -> store

本段负责：

- 写库前检查
- embedding
- 写入向量库
- 验证导入结果
- 记录 manifest

第一阶段先提供占位总控，后续再继续向下细分。

根总控：

- `segment-chunks-to-store.ts`

后续可继续细分为：

- `00-pre-write-check/`
- `01-embed-batches/`
- `02-write-store/`
- `03-verify-write/`
- `04-write-manifest/`
