import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 仓库根目录（本文件位于 `src/knowledge/`） */
export const PROJECT_ROOT = join(__dirname, "..", "..");

/** 统一 RAG 向量文件（多集合合并存储） */
export const DEFAULT_RAG_STORE_PATH = join(
  PROJECT_ROOT,
  "data",
  "knowledge",
  "rag-store.json",
);

/** 旧版仅职位库文件名；若存在且无 rag-store，ingest:jobs 会参与迁移合并 */
export const LEGACY_JOB_POSTS_STORE_PATH = join(
  PROJECT_ROOT,
  "data",
  "knowledge",
  "job-posts.json",
);
