# Knowledge Importer · 金字塔目录

本目录是 `knowledge-importer` 的主实现区。

结构规则：

- 每个功能目录的根代码文件，与该目录同名，是该目录的总控
- 有子目录时，根代码文件负责调度子目录
- 无子目录时，根代码文件直接实现本层功能
- 兼容脚本只做转调，不承载主实现

主线：

- `load -> normalized`
- `normalized -> chunks`
- `chunks -> store`

## 根目录子文件夹

| 文件夹 | 根总控 | 作用 |
| --- | --- | --- |
| `segment-load-to-normalized/` | `segment-load-to-normalized/segment-load-to-normalized.ts` | 按来源读取输入、解析元数据、统一生成 `ImportDocument`。 |
| `segment-normalized-to-chunks/` | `segment-normalized-to-chunks/segment-normalized-to-chunks.ts` | 按内容类型选择切块策略，生成标准 chunk records。 |
| `segment-chunks-to-store/` | `segment-chunks-to-store/segment-chunks-to-store.ts` | 完成 embedding、写库、验证、manifest。 |
| `tools/` | 各工具根文件待定 | 面向单来源或调试任务的便捷入口。 |

## 设计原则

该工具明确参考 `side-tools/pdf-text-cleanup/pyramid/` 的组织方式，目标不是最少文件，而是：

- 让每个阶段都能持续细分
- 让每个阶段都始终有根总控收束
- 让后续入库优化集中发生在清晰的阶段边界内
