import type OpenAI from "openai";

import { COLLECTION_PERSONAL } from "./collections.js";
import { chunkText } from "./chunk.js";
import { embedTextChunks, loadRagStoreOrLegacy } from "./ingest.js";
import { getEmbeddingModel } from "./embeddings.js";
import { mergeStoreAppendChunks } from "./store-merge.js";
import { DEFAULT_RAG_STORE_PATH } from "./paths.js";
import type { TextChunk } from "./types.js";
import { saveVectorStore } from "./vector-file-store.js";

export interface PersonalIngestMeta {
  /** 展示用，如原始文件名 */
  sourceLabel: string;
  /** 逻辑来源，如 uploads/xxx.md */
  sourcePath: string;
  /** 用于块 id 前缀，避免碰撞 */
  idPrefix: string;
}

/**
 * 将纯文本并入 `personal` 集合（追加块，不删除历史 personal）。
 */
export async function ingestPersonalPlainText(
  client: OpenAI,
  rawText: string,
  meta: PersonalIngestMeta,
): Promise<{ chunkCount: number }> {
  const trimmed = rawText.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return { chunkCount: 0 };
  }

  const parts = chunkText(trimmed);
  const textChunks: TextChunk[] = parts.map((text, chunkIndex) => ({
    id: `${meta.idPrefix}-c${chunkIndex}`,
    collection: COLLECTION_PERSONAL,
    sourcePath: meta.sourcePath,
    sourceLabel: meta.sourceLabel,
    text,
    chunkIndex,
  }));

  const stored = await embedTextChunks(client, textChunks);
  const existing = loadRagStoreOrLegacy();
  const store = mergeStoreAppendChunks(
    existing,
    stored,
    getEmbeddingModel(),
  );
  saveVectorStore(DEFAULT_RAG_STORE_PATH, store);
  return { chunkCount: stored.length };
}
