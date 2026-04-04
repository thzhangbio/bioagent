import type { KnowledgeCollection } from "./types.js";

/**
 * 对话侧 `retrieve` 默认集合（`augmentUserTextWithRag`）。
 * **单一数据源**：`report-explicit-state` 与文档由此导出，避免与实现漂移。
 */
export const CHAT_RAG_DEFAULT_COLLECTIONS: readonly KnowledgeCollection[] = [
  "platform_tone",
  "medical",
  "literature",
  "personal",
];

/**
 * 内容创作工作流 `retrieve` 默认集合（与对话侧当前一致）。
 * **默认不含** `wechat_style`、`job_post`。
 */
export const CONTENT_RAG_DEFAULT_COLLECTIONS: readonly KnowledgeCollection[] = [
  "platform_tone",
  "medical",
  "literature",
  "personal",
];

/** 全部集合 ID（与 {@link KnowledgeCollection} 对齐，供报表枚举） */
export const ALL_KNOWLEDGE_COLLECTIONS: readonly KnowledgeCollection[] = [
  "job_post",
  "platform_tone",
  "medical",
  "personal",
  "literature",
  "wechat_style",
];
