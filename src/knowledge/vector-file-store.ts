import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { cosineSimilarity } from "./cosine.js";
import type { StoredVectorChunk, VectorStoreFile } from "./types.js";

export function loadVectorStore(path: string): VectorStoreFile {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as VectorStoreFile;
}

export function saveVectorStore(path: string, store: VectorStoreFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store), "utf-8");
}

export interface SearchHit {
  chunk: StoredVectorChunk;
  score: number;
}

export function searchVectorStore(
  store: VectorStoreFile,
  queryEmbedding: number[],
  topK: number,
): SearchHit[] {
  const scored: SearchHit[] = store.chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
