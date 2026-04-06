# Knowledge Importer

统一管理知识库入库流程的独立工具。

## 定位

- `side-tools/*`：负责清洗原始内容
- `tools/knowledge-importer`：负责把清洗产物统一导入知识库
- `src/knowledge/*`：负责主项目运行时检索与向量库读写

本工具的目标不是替代所有现有能力，而是把入库相关优化集中到一个地方。

## 第一阶段范围

- 统一 CLI 入口
- 统一中间数据结构
- 文献 `literature_kb` 适配器
- 微信 `wechat_style` 适配器
- 预置库 `presets` 适配器
- 岗位库 `job_posts` 适配器
- 统一写库 / 验证 / manifest

## 架构原则

本工具采用与 `pdf-text-cleanup` 一致的金字塔式目录：

- 每个功能目录的根代码文件，与目录同名，是该目录总控
- 有子目录时，根代码文件负责调度子目录
- 无子目录时，根代码文件直接实现本层功能
- 某一步复杂后，直接在该段下继续细分，不推翻整体结构

## 计划目录

```text
tools/knowledge-importer/
├── README.md
├── cli/
│   └── knowledge-import.ts
└── pyramid/
    ├── README.md
    ├── knowledge-importer.ts
    ├── segment-load-to-normalized/
    ├── segment-normalized-to-chunks/
    ├── segment-chunks-to-store/
    └── tools/
```

## 设计文档

详见：

- [`docs/知识库导入器设计.md`](/Users/tianhui/Webstart/bioagent/docs/知识库导入器设计.md)

## 迁移原则

第一阶段保持现有命令可用：

- `pnpm run ingest:literature`
- `pnpm run ingest:wechat`
- `pnpm run pdf-kb-out-to-knowledge`

后续逐步改为内部调用本工具，而不是一次性硬切。
