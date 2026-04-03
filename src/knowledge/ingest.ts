import type OpenAI from "openai";

import { embedTexts, getEmbeddingModel } from "./embeddings.js";
import type { StoredVectorChunk, TextChunk, VectorStoreFile } from "./types.js";
import { existsSync } from "node:fs";
import { loadVectorStore } from "./vector-file-store.js";
import {
  DEFAULT_RAG_STORE_PATH,
  LEGACY_JOB_POSTS_STORE_PATH,
} from "./paths.js";
import { mergeStoreByReplacingCollections } from "./store-merge.js";

const DEFAULT_BATCH = 16;

export {
  mergeStoreByReplacingCollections,
  mergeStoreAppendChunks,
} from "./store-merge.js";

/**
 * 将文本块批量嵌入为带向量的块（顺序与输入一致）。
 */
export async function embedTextChunks(
  client: OpenAI,
  textChunks: TextChunk[],
  batchSize = DEFAULT_BATCH,
): Promise<StoredVectorChunk[]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < textChunks.length; i += batchSize) {
    const batch = textChunks.slice(i, i + batchSize);
    const vectors = await embedTexts(
      client,
      batch.map((c) => c.text),
    );
    embeddings.push(...vectors);
  }
  return textChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i]!,
  }));
}

/**
 * 加载当前应作为「已有库」参与合并的数据：优先 `rag-store.json`，否则兼容旧版 `job-posts.json`。
 */
export function loadRagStoreOrLegacy(): VectorStoreFile | null {
  if (existsSync(DEFAULT_RAG_STORE_PATH)) {
    return loadVectorStore(DEFAULT_RAG_STORE_PATH);
  }
  if (existsSync(LEGACY_JOB_POSTS_STORE_PATH)) {
    return loadVectorStore(LEGACY_JOB_POSTS_STORE_PATH);
  }
  return null;
}

export function buildMergedStore(
  replaceCollections: import("./types.js").KnowledgeCollection[],
  newChunks: StoredVectorChunk[],
): VectorStoreFile {
  const existing = loadRagStoreOrLegacy();
  return mergeStoreByReplacingCollections(
    existing,
    replaceCollections,
    newChunks,
    getEmbeddingModel(),
  );
}
