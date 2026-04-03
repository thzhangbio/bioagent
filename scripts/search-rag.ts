/**
 * 在统一向量库 `data/knowledge/rag-store.json` 中检索。
 * 用法:
 *   pnpm run search:rag -- "你的查询"
 *   pnpm run search:rag -- "查询" --only platform_tone,medical
 */
import "dotenv/config";
import { existsSync } from "node:fs";

import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";
import { retrieve } from "../src/knowledge/retrieve.js";
import type { KnowledgeCollection } from "../src/knowledge/types.js";

const VALID: KnowledgeCollection[] = [
  "job_post",
  "platform_tone",
  "medical",
  "personal",
];

function parseArgs(): { query: string; collections?: KnowledgeCollection[] } {
  const raw = process.argv.slice(2).filter((a) => a !== "--");
  const onlyIdx = raw.indexOf("--only");
  let collections: KnowledgeCollection[] | undefined;
  let parts = [...raw];
  if (onlyIdx >= 0) {
    const list = raw[onlyIdx + 1];
    if (!list) {
      console.error("--only 需要逗号分隔集合名，如: job_post,medical");
      process.exit(1);
    }
    collections = list.split(",").map((s) => s.trim()) as KnowledgeCollection[];
    for (const c of collections) {
      if (!VALID.includes(c)) {
        console.error(`未知集合: ${c}，可选: ${VALID.join(", ")}`);
        process.exit(1);
      }
    }
    parts = raw.slice(0, onlyIdx);
  }
  const query = parts.join(" ").trim();
  return { query, collections };
}

async function main(): Promise<void> {
  const { query, collections } = parseArgs();
  if (!query) {
    console.error('用法: pnpm run search:rag -- "查询"  或加 --only job_post,platform_tone');
    process.exit(1);
  }
  if (!existsSync(DEFAULT_RAG_STORE_PATH)) {
    console.error(
      `未找到 ${DEFAULT_RAG_STORE_PATH}\n请先: pnpm run ingest:presets && pnpm run ingest:jobs`,
    );
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const hits = await retrieve(client, query, {
    collections,
    topK: 8,
  });

  const storeLabel = collections?.length ?
    collections.join(", ")
  : "全部集合";
  console.log(`查询: ${query}\n范围: ${storeLabel}\n`);

  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    const c = h.chunk;
    console.log(
      `--- #${i + 1} score=${h.score.toFixed(4)} [${c.collection}] ${c.sourceLabel} ---`,
    );
    console.log(c.text.slice(0, 700) + (c.text.length > 700 ? "…" : ""));
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
