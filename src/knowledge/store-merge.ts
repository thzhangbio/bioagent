import type { KnowledgeCollection, StoredVectorChunk, VectorStoreFile } from "./types.js";

/**
 * 从现有库中移除指定集合的全部块，再追加新块（用于增量重灌某一类知识）。
 */
export function mergeStoreByReplacingCollections(
  existing: VectorStoreFile | null,
  replace: KnowledgeCollection[],
  incoming: StoredVectorChunk[],
  embeddingModel: string,
): VectorStoreFile {
  const remove = new Set(replace);
  const kept = existing?.chunks.filter((c) => !remove.has(c.collection)) ?? [];
  return {
    version: 1,
    embeddingModel,
    createdAt: new Date().toISOString(),
    chunks: [...kept, ...incoming],
  };
}
