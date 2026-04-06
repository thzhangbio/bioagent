# Segment: normalized -> chunks

本段负责：

- 按来源选择 chunk 策略
- 将 `ImportDocument` 转成 `ImportChunkRecord`
- 预留后续章节感知、槽位感知和质量检查的扩展位置

根总控：

- `segment-normalized-to-chunks.ts`

后续可继续细分为：

- `00-select-chunker/`
- `01-section-split/`
- `02-window-chunk/`
- `03-build-chunk-records/`
- `04-chunk-quality-check/`
