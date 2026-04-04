/**
 * 将 `data/knowledge/literature-inbox/` 下 Markdown 切块嵌入，写入统一向量库中的 **literature（事实层）** 集合。
 *
 * 用法: pnpm run ingest:literature
 *
 * 环境变量:
 *   LITERATURE_INBOX — 可选，覆盖默认 inbox 目录（绝对或相对仓库根）
 *
 * 可选侧车元数据：与 `foo.md` 同目录的 `foo.meta.json`
 *   { "paperId": "...", "sourceUrl": "https://doi.org/...", "sourceLabel": "..." }
 *
 * **DOI 主键**：`sourceUrl` 或 `paperId`（形如 `10.xxxx/...`）可解析为 DOI 时，所有块的 `paperId`
 * 均为**规范化注册 DOI**。同一批次内多篇 `.md` 若 DOI 相同，视为**同一篇文献的补充**，块 id 按文件区分避免碰撞。
 *
 * 会**替换**库内全部 `literature` 块，不影响 platform_tone / medical / personal / job_post。
 */
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chunkText } from "../src/knowledge/chunk.js";
import { COLLECTION_LITERATURE } from "../src/knowledge/collections.js";
import {
  doiToSlug,
  extractFirstDoiFromMarkdown,
  looksLikeDoiString,
  normalizeDoi,
} from "../src/knowledge/doi.js";
import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import {
  buildMergedStore,
  embedTextChunks,
} from "../src/knowledge/ingest.js";
import { DEFAULT_RAG_STORE_PATH, PROJECT_ROOT } from "../src/knowledge/paths.js";
import type { TextChunk } from "../src/knowledge/types.js";
import { saveVectorStore } from "../src/knowledge/vector-file-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT_ROOT = join(__dirname, "..");

interface LiteratureMeta {
  paperId?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

function defaultInbox(): string {
  const fromEnv = process.env.LITERATURE_INBOX?.trim();
  if (fromEnv) return join(SCRIPT_ROOT, fromEnv);
  return join(PROJECT_ROOT, "data", "knowledge", "literature-inbox");
}

function loadMeta(inbox: string, baseName: string): LiteratureMeta | null {
  const metaPath = join(inbox, `${baseName}.meta.json`);
  if (!existsSync(metaPath)) return null;
  try {
    const raw = readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as LiteratureMeta;
  } catch {
    return null;
  }
}

function sanitizeFileKey(fileBase: string): string {
  const s = fileBase
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return s || "doc";
}

/**
 * 解析文献主键：DOI 优先，其次 meta.paperId（人类可读 slug），再正文首条 DOI，最后文件名。
 */
function resolvePaperId(
  meta: LiteratureMeta | null,
  rawMd: string,
  fileBase: string,
): { paperId: string; canonicalDoi: string | null; sourceUrl?: string } {
  const fromSourceUrl = meta?.sourceUrl?.trim()
    ? normalizeDoi(meta.sourceUrl)
    : null;
  if (fromSourceUrl) {
    return {
      paperId: fromSourceUrl,
      canonicalDoi: fromSourceUrl,
      sourceUrl: meta?.sourceUrl?.trim().startsWith("http")
        ? meta.sourceUrl.trim()
        : `https://doi.org/${fromSourceUrl}`,
    };
  }

  const pid = meta?.paperId?.trim();
  if (pid && looksLikeDoiString(pid)) {
    const n = normalizeDoi(pid);
    if (n) {
      return {
        paperId: n,
        canonicalDoi: n,
        sourceUrl: `https://doi.org/${n}`,
      };
    }
  }

  const fromBody = extractFirstDoiFromMarkdown(rawMd);
  if (fromBody) {
    return {
      paperId: fromBody,
      canonicalDoi: fromBody,
      sourceUrl: `https://doi.org/${fromBody}`,
    };
  }

  if (pid) {
    return { paperId: pid, canonicalDoi: null, sourceUrl: meta?.sourceUrl?.trim() };
  }

  const fallback =
    fileBase.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || fileBase;
  return {
    paperId: fallback,
    canonicalDoi: null,
    sourceUrl: meta?.sourceUrl?.trim(),
  };
}

async function main(): Promise<void> {
  const inbox = defaultInbox();
  if (!existsSync(inbox)) {
    mkdirSync(inbox, { recursive: true });
    console.warn(`已创建空目录: ${inbox}（请放入 .md 后再执行）`);
  }

  const files = existsSync(inbox)
    ? readdirSync(inbox).filter(
        (f) => f.endsWith(".md") && f.toUpperCase() !== "README.MD",
      )
    : [];

  if (files.length === 0) {
    console.error(`未在文献目录中找到 .md 文件: ${inbox}`);
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const textChunks: TextChunk[] = [];
  const doiCounts = new Map<string, number>();

  for (const file of files.sort()) {
    const abs = join(inbox, file);
    const raw = readFileSync(abs, "utf-8");
    const base = basename(file, ".md");
    const meta = loadMeta(inbox, base);
    const sourcePath = abs.replace(PROJECT_ROOT + "/", "");

    const { paperId, canonicalDoi, sourceUrl: resolvedUrl } = resolvePaperId(
      meta,
      raw,
      base,
    );
    const sourceLabel =
      meta?.sourceLabel ?? base.replace(/-/g, " ").slice(0, 120);

    const idPrefix = doiToSlug(canonicalDoi ?? paperId);
    const fileKey = sanitizeFileKey(base);

    const parts = chunkText(raw);
    parts.forEach((text, chunkIndex) => {
      textChunks.push({
        id: `${idPrefix}__${fileKey}__c${chunkIndex}`,
        collection: COLLECTION_LITERATURE,
        sourcePath,
        sourceLabel,
        text,
        chunkIndex,
        paperId,
        sourceUrl: resolvedUrl ?? meta?.sourceUrl,
      });
    });

    const key = canonicalDoi ?? paperId;
    doiCounts.set(key, (doiCounts.get(key) ?? 0) + 1);
  }

  const doiSummary = [...doiCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => `${k} ← ${n} 个文件`)
    .join("; ");
  console.log(
    `文献文件 ${files.length} 个，切块 ${textChunks.length} 条 → 合并入 ${DEFAULT_RAG_STORE_PATH}（仅替换 literature）`,
  );
  if (doiSummary) {
    console.log(`同一 DOI/主键多文件补充: ${doiSummary}`);
  }

  const stored = await embedTextChunks(client, textChunks);
  const store = buildMergedStore([COLLECTION_LITERATURE], stored);

  mkdirSync(join(PROJECT_ROOT, "data", "knowledge"), { recursive: true });
  saveVectorStore(DEFAULT_RAG_STORE_PATH, store);
  console.log(`已写入，总块数 ${store.chunks.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
