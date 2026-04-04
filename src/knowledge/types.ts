/**
 * RAG 集合名：与《实现路线图》及《知识库分层与文献库规划》对齐。
 * - `literature`：事实层（论文/指南等可核对来源）
 */
export type KnowledgeCollection =
  | "job_post"
  | "platform_tone"
  | "medical"
  | "personal"
  | "literature";

export interface TextChunk {
  id: string;
  collection: KnowledgeCollection;
  /** 仓库内相对路径，便于追溯 */
  sourcePath: string;
  /** 人类可读来源，如「公司名-职位名」或论文短标题 */
  sourceLabel: string;
  text: string;
  chunkIndex: number;
  /** 事实层文献：可选稳定 ID（文件名 slug 或 meta） */
  paperId?: string;
  /** 事实层文献：可选 DOI / 出版社链接，供未来溯源展示 */
  sourceUrl?: string;
}

export interface StoredVectorChunk extends TextChunk {
  embedding: number[];
}

export interface VectorStoreFile {
  version: 1;
  embeddingModel: string;
  createdAt: string;
  chunks: StoredVectorChunk[];
}
