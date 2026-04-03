export {
  COLLECTION_JOB_POST,
  COLLECTION_MEDICAL,
  COLLECTION_PLATFORM_TONE,
} from "./collections.js";
export { chunkText } from "./chunk.js";
export {
  createEmbeddingClient,
  embedTexts,
  getEmbeddingModel,
} from "./embeddings.js";
export { cosineSimilarity } from "./cosine.js";
export {
  embedTextChunks,
  buildMergedStore,
  loadRagStoreOrLegacy,
} from "./ingest.js";
export { mergeStoreByReplacingCollections } from "./store-merge.js";
export {
  DEFAULT_RAG_STORE_PATH,
  LEGACY_JOB_POSTS_STORE_PATH,
  PROJECT_ROOT,
} from "./paths.js";
export { retrieve, type RetrieveOptions } from "./retrieve.js";
export {
  loadVectorStore,
  saveVectorStore,
  searchVectorStore,
  type SearchHit,
} from "./vector-file-store.js";
export type {
  KnowledgeCollection,
  StoredVectorChunk,
  TextChunk,
  VectorStoreFile,
} from "./types.js";
