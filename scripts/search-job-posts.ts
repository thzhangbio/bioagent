/**
 * 在已生成的职位向量库中检索。用法:
 *   pnpm run search:jobs -- "医学文献检索 英语六级"
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createEmbeddingClient, embedTexts } from "../src/knowledge/embeddings.js";
import { loadVectorStore, searchVectorStore } from "../src/knowledge/vector-file-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const STORE = join(ROOT, "data", "knowledge", "job-posts.json");

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
  if (!existsSync(STORE)) {
    console.error(`请先运行: pnpm run ingest:jobs\n（未找到 ${STORE}）`);
    process.exit(1);
  }

  const store = loadVectorStore(STORE);
  const client = createEmbeddingClient();
  const [qvec] = await embedTexts(client, [query]);
  const hits = searchVectorStore(store, qvec, 5);

  console.log(`查询: ${query}\n模型: ${store.embeddingModel}  块数: ${store.chunks.length}\n`);
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
