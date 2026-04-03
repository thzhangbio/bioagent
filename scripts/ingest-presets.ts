/**
 * 将仓库内 `rag-presets/*.md` 切块、嵌入后写入统一向量库（集合 platform_tone、medical）。
 * 用法: pnpm run ingest:presets
 *
 * 会替换库中已有 `platform_tone` 与 `medical` 集合的全部块，不影响 job_post / personal。
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COLLECTION_MEDICAL,
  COLLECTION_PLATFORM_TONE,
} from "../src/knowledge/collections.js";
import { chunkText } from "../src/knowledge/chunk.js";
import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import {
  buildMergedStore,
  embedTextChunks,
} from "../src/knowledge/ingest.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";
import type { TextChunk } from "../src/knowledge/types.js";
import { saveVectorStore } from "../src/knowledge/vector-file-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const PRESET_DIR = join(ROOT, "rag-presets");

const PRESETS: { file: string; collection: typeof COLLECTION_PLATFORM_TONE | typeof COLLECTION_MEDICAL; label: string }[] = [
  {
    file: "platform-tone.md",
    collection: COLLECTION_PLATFORM_TONE,
    label: "平台调性（预置）",
  },
  {
    file: "medical-compliance.md",
    collection: COLLECTION_MEDICAL,
    label: "医学与合规（预置）",
  },
];

async function main(): Promise<void> {
  const textChunks: TextChunk[] = [];

  for (const p of PRESETS) {
    const abs = join(PRESET_DIR, p.file);
    if (!existsSync(abs)) {
      throw new Error(`缺少预置文件: ${abs}`);
    }
    const raw = readFileSync(abs, "utf-8");
    const sourcePath = join("rag-presets", p.file);
    const parts = chunkText(raw);
    parts.forEach((text, chunkIndex) => {
      const id = `${basename(p.file, ".md")}-c${chunkIndex}`;
      textChunks.push({
        id,
        collection: p.collection,
        sourcePath,
        sourceLabel: p.label,
        text,
        chunkIndex,
      });
    });
  }

  console.log(`预置文件 ${PRESETS.length} 个，切块 ${textChunks.length} 条`);

  const client = createEmbeddingClient();
  const stored = await embedTextChunks(client, textChunks);
  const store = buildMergedStore(
    [COLLECTION_PLATFORM_TONE, COLLECTION_MEDICAL],
    stored,
  );

  mkdirSync(join(ROOT, "data", "knowledge"), { recursive: true });
  saveVectorStore(DEFAULT_RAG_STORE_PATH, store);
  console.log(`已写入: ${DEFAULT_RAG_STORE_PATH}（总块数 ${store.chunks.length}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
