/** RAG 集合名：与《实现路线图》中的 collection 概念对齐 */
export type KnowledgeCollection = "job_post" | "platform_tone" | "medical" | "personal";

export interface TextChunk {
  id: string;
  collection: KnowledgeCollection;
  /** 仓库内相对路径，便于追溯 */
  sourcePath: string;
  /** 人类可读来源，如「公司名-职位名」 */
  sourceLabel: string;
  text: string;
  chunkIndex: number;
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
