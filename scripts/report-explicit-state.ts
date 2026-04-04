/**
 * 从代码与本地 rag-store 生成「显式状态」快照，写入 docs/显式状态.generated.md。
 * 运行：pnpm run report:explicit-state
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddingModel } from "../src/knowledge/embeddings.js";
import {
  ALL_KNOWLEDGE_COLLECTIONS,
  CHAT_RAG_DEFAULT_COLLECTIONS,
  CONTENT_RAG_DEFAULT_COLLECTIONS,
} from "../src/knowledge/rag-default-collections.js";
import { loadVectorStore } from "../src/knowledge/vector-file-store.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function parseEnvExampleKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const line of text.split("\n")) {
    const t = line.trim();
    const m = t.match(/^#?\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (m) keys.add(m[1]!);
  }
  return [...keys].sort();
}

function countChunksByCollection(storePath: string): Record<string, number> | null {
  if (!existsSync(storePath)) return null;
  const store = loadVectorStore(storePath);
  const counts: Record<string, number> = {};
  for (const c of ALL_KNOWLEDGE_COLLECTIONS) counts[c] = 0;
  for (const row of store.chunks) {
    const c = row.collection;
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

function main(): void {
  const envExamplePath = join(ROOT, ".env.example");
  const envKeys = existsSync(envExamplePath)
    ? parseEnvExampleKeys(readFileSync(envExamplePath, "utf8"))
    : [];

  const chunkCounts = countChunksByCollection(DEFAULT_RAG_STORE_PATH);
  const embeddingModel = getEmbeddingModel();

  const notInChatDefault = ALL_KNOWLEDGE_COLLECTIONS.filter(
    (c) => !CHAT_RAG_DEFAULT_COLLECTIONS.includes(c)
  );

  const iso = new Date().toISOString();

  const lines: string[] = [
    "# 显式状态（自动生成）",
    "",
    `> **本文件由 \`pnpm run report:explicit-state\` 生成，请勿手改。** 生成时间（UTC）：\`${iso}\``,
    "",
    "## 1. 对话侧默认 RAG 集合",
    "",
    "`CHAT_RAG_DEFAULT_COLLECTIONS`（`src/knowledge/rag-default-collections.ts`）：",
    "",
    "```",
    JSON.stringify([...CHAT_RAG_DEFAULT_COLLECTIONS], null, 2),
    "```",
    "",
    "## 2. 内容创作默认 RAG 集合",
    "",
    "`CONTENT_RAG_DEFAULT_COLLECTIONS`：",
    "",
    "```",
    JSON.stringify([...CONTENT_RAG_DEFAULT_COLLECTIONS], null, 2),
    "```",
    "",
    "## 3. 未纳入默认检索的集合（需在代码或调用参数中显式指定）",
    "",
    notInChatDefault.map((c) => `- \`${c}\``).join("\n"),
    "",
    "## 4. Embedding 默认模型",
    "",
    `- \`getEmbeddingModel()\` → \`${embeddingModel}\`（\`src/knowledge/embeddings.ts\`）`,
    "",
    "## 5. 本地向量库块数（按 collection）",
    "",
    chunkCounts
      ? "- 路径：`data/knowledge/rag-store.json`（相对仓库根）"
      : "- 未找到 `data/knowledge/rag-store.json`，跳过统计。",
    "",
  ];

  if (chunkCounts) {
    lines.push("| collection | chunks |");
    lines.push("|------------|--------|");
    for (const c of ALL_KNOWLEDGE_COLLECTIONS) {
      lines.push(`| \`${c}\` | ${chunkCounts[c] ?? 0} |`);
    }
    lines.push("");
  }

  lines.push("## 6. `.env.example` 中的变量名（仓库约定）", "");
  if (envKeys.length === 0) {
    lines.push("（未读取到 `.env.example`）", "");
  } else {
    lines.push(...envKeys.map((k) => `- \`${k}\``));
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "说明：环境变量**实际取值**以本机 `.env` 为准，本报告不读取 `.env`，避免泄露密钥。",
    ""
  );

  const outPath = join(ROOT, "docs", "显式状态.generated.md");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
