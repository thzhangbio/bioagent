/**
 * 将 research/医学编辑岗-苏州-整理 下编号岗位 Markdown 切块、Embedding 后合并进统一向量库 `data/knowledge/rag-store.json`。
 * 用法: pnpm run ingest:jobs
 *
 * 仅替换集合 `job_post`，保留 `platform_tone` / `medical` / `personal` 等其它集合。
 * 若仅有旧版 `job-posts.json` 而无 `rag-store.json`，会先作为迁移基座再合并。
 *
 * 需配置: OPENAI_API_KEY, OPENAI_BASE_URL, EMBEDDING_MODEL（见 .env.example）
 */
import "dotenv/config";
import { mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLLECTION_JOB_POST } from "../src/knowledge/collections.js";
import { chunkText } from "../src/knowledge/chunk.js";
import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import { buildMergedStore, embedTextChunks } from "../src/knowledge/ingest.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";
import type { TextChunk } from "../src/knowledge/types.js";
import { saveVectorStore } from "../src/knowledge/vector-file-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const JOB_DIR = join(ROOT, "research", "医学编辑岗-苏州-整理");

function listJobMarkdownFiles(): string[] {
  if (!existsSync(JOB_DIR)) {
    throw new Error(`目录不存在: ${JOB_DIR}`);
  }
  return readdirSync(JOB_DIR)
    .filter((f) => /^\d{2}-.+\.md$/.test(f))
    .sort()
    .map((f) => join(JOB_DIR, f));
}

function labelFromFilename(file: string): string {
  const name = basename(file, ".md");
  return name.replace(/^\d{2}-/, "");
}

function roughTokenEstimate(text: string): number {
  return Math.ceil(text.length / 1.7);
}

async function main(): Promise<void> {
  const files = listJobMarkdownFiles();
  if (files.length === 0) {
    console.error("未找到 医学编辑岗-苏州-整理 下的编号岗位 .md 文件");
    process.exit(1);
  }

  const client = createEmbeddingClient();

  const textChunks: TextChunk[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf-8");
    const sourcePath = file.replace(ROOT + "/", "");
    const label = labelFromFilename(file);
    const parts = chunkText(raw);
    parts.forEach((text, chunkIndex) => {
      const id = `${basename(file, ".md")}-c${chunkIndex}`;
      textChunks.push({
        id,
        collection: COLLECTION_JOB_POST,
        sourcePath,
        sourceLabel: label,
        text,
        chunkIndex,
      });
    });
  }

  console.log(
    `岗位文件 ${files.length} 个，切块 ${textChunks.length} 条 → 合并入 ${DEFAULT_RAG_STORE_PATH}`,
  );

  const stored = await embedTextChunks(client, textChunks);
  const store = buildMergedStore([COLLECTION_JOB_POST], stored);

  mkdirSync(join(ROOT, "data", "knowledge"), { recursive: true });
  saveVectorStore(DEFAULT_RAG_STORE_PATH, store);

  const totalChars = textChunks.reduce((s, c) => s + c.text.length, 0);
  const estTokens = textChunks.reduce((s, c) => s + roughTokenEstimate(c.text), 0);
  console.log(`\n已写入: ${DEFAULT_RAG_STORE_PATH}`);
  console.log(`库内总块数: ${store.chunks.length}`);
  console.log(
    `本批岗位粗估 token 约 ${estTokens.toLocaleString()}（以服务商账单为准）`,
  );
  console.log(`本批岗位总字符约 ${totalChars.toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
