import type OpenAI from "openai";
import { existsSync } from "node:fs";

import { embedTexts } from "./embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "./paths.js";
import { loadVectorStore, searchVectorStore, type SearchHit } from "./vector-file-store.js";
import type { KnowledgeCollection } from "./types.js";

export interface RetrieveOptions {
  /** 限定检索的集合；不传则检索库内全部集合 */
  collections?: KnowledgeCollection[];
  topK: number;
  /** 默认 `data/knowledge/rag-store.json` */
  storePath?: string;
}

/**
 * 对查询句嵌入后，在向量库中做余弦相似度 topK（可选按集合过滤）。
 */
export async function retrieve(
  client: OpenAI,
  query: string,
  options: RetrieveOptions,
): Promise<SearchHit[]> {
  const path = options.storePath ?? DEFAULT_RAG_STORE_PATH;
  if (!existsSync(path)) {
    throw new Error(
      `向量库不存在: ${path}（请先执行 pnpm run ingest:presets / ingest:jobs）`,
    );
  }
  const store = loadVectorStore(path);
  const chunks =
    options.collections?.length ?
      store.chunks.filter((c) => options.collections!.includes(c.collection))
    : store.chunks;
  const subStore = { ...store, chunks };
  const [qvec] = await embedTexts(client, [query]);
  return searchVectorStore(subStore, qvec, options.topK);
}
