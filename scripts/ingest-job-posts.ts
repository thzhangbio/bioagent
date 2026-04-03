/**
 * 将 research/医学编辑岗-苏州-整理 下编号岗位 Markdown 切块、Embedding 后写入本地向量文件。
 * 用法: pnpm run ingest:jobs
 *
 * 需配置: OPENAI_API_KEY, OPENAI_BASE_URL, EMBEDDING_MODEL（见 .env.example）
 */
import "dotenv/config";
import { mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLLECTION_JOB_POST } from "../src/knowledge/collections.js";
import { chunkText } from "../src/knowledge/chunk.js";
import { createEmbeddingClient, embedTexts, getEmbeddingModel } from "../src/knowledge/embeddings.js";
import { saveVectorStore } from "../src/knowledge/vector-file-store.js";
import type { StoredVectorChunk, TextChunk, VectorStoreFile } from "../src/knowledge/types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const JOB_DIR = join(ROOT, "research", "医学编辑岗-苏州-整理");
const OUT_FILE = join(ROOT, "data", "knowledge", "job-posts.json");
const BATCH = 16;

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
  // 粗算：中文约每 1.5～2 字 1 token，此处取中值偏保守
  return Math.ceil(text.length / 1.7);
}

async function main(): Promise<void> {
  const files = listJobMarkdownFiles();
  if (files.length === 0) {
    console.error("未找到 医学编辑岗-苏州-整理 下的编号岗位 .md 文件");
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const model = getEmbeddingModel();

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
    `岗位文件 ${files.length} 个，切块 ${textChunks.length} 条，模型 ${model}`,
  );

  const embeddings: number[][] = [];
  for (let i = 0; i < textChunks.length; i += BATCH) {
    const batch = textChunks.slice(i, i + BATCH);
    const vectors = await embedTexts(
      client,
      batch.map((c) => c.text),
    );
    embeddings.push(...vectors);
    console.log(`  已嵌入 ${Math.min(i + BATCH, textChunks.length)}/${textChunks.length}`);
  }

  const chunks: StoredVectorChunk[] = textChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i]!,
  }));

  const store: VectorStoreFile = {
    version: 1,
    embeddingModel: model,
    createdAt: new Date().toISOString(),
    chunks,
  };

  mkdirSync(join(ROOT, "data", "knowledge"), { recursive: true });
  saveVectorStore(OUT_FILE, store);

  const totalChars = textChunks.reduce((s, c) => s + c.text.length, 0);
  const estTokens = textChunks.reduce((s, c) => s + roughTokenEstimate(c.text), 0);
  console.log(`\n已写入: ${OUT_FILE}`);
  console.log(
    `粗估输入 token 约 ${estTokens.toLocaleString()}（用于成本参考；以服务商账单为准）`,
  );
  console.log(`总字符约 ${totalChars.toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
