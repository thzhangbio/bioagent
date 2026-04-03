/**
 * 仅在 `job_post` 集合中检索（职位实验库）。
 * 用法: pnpm run search:jobs -- "医学文献检索 英语六级"
 */
import "dotenv/config";
import { existsSync } from "node:fs";

import { COLLECTION_JOB_POST } from "../src/knowledge/collections.js";
import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";
import { retrieve } from "../src/knowledge/retrieve.js";

async function main(): Promise<void> {
  const query = process.argv
    .slice(2)
    .filter((a) => a !== "--")
    .join(" ")
    .trim();
  if (!query) {
    console.error('用法: pnpm run search:jobs -- "你的查询句子"');
    process.exit(1);
  }
  if (!existsSync(DEFAULT_RAG_STORE_PATH)) {
    console.error(
      `请先运行: pnpm run ingest:jobs\n（未找到统一库 ${DEFAULT_RAG_STORE_PATH}）`,
    );
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const hits = await retrieve(client, query, {
    collections: [COLLECTION_JOB_POST],
    topK: 5,
  });

  console.log(
    `查询: ${query}\n范围: job_post  命中展示 ${hits.length} 条\n`,
  );
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    console.log(`--- #${i + 1} score=${h.score.toFixed(4)} | ${h.chunk.sourceLabel} ---`);
    console.log(h.chunk.text.slice(0, 600) + (h.chunk.text.length > 600 ? "…" : ""));
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
