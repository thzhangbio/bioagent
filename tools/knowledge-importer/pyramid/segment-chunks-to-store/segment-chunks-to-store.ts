import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { createEmbeddingClient, getEmbeddingModel } from "../../../../src/knowledge/embeddings.js";
import {
  buildMergedStore,
  embedTextChunks,
  loadRagStoreOrLegacy,
} from "../../../../src/knowledge/ingest.js";
import { DEFAULT_RAG_STORE_PATH } from "../../../../src/knowledge/paths.js";
import { saveVectorStore } from "../../../../src/knowledge/vector-file-store.js";
import type { StoredVectorChunk, TextChunk, VectorStoreFile } from "../../../../src/knowledge/types.js";
import {
  appendKnowledgeImporterNote,
  type ImportChunkRecord,
  type KnowledgeImporterContext,
  type KnowledgeImporterStage,
} from "../stage-shared.js";

function toRelativeSourcePath(cwd: string, absOrRelative: string): string {
  if (!absOrRelative.startsWith("/")) return absOrRelative;
  return relative(cwd, absOrRelative) || absOrRelative;
}

function toTextChunk(context: KnowledgeImporterContext, record: ImportChunkRecord): TextChunk {
  const meta = record.metadata;
  return {
    id: record.id,
    collection: record.collection,
    sourceId: record.sourceId,
    sourcePath: toRelativeSourcePath(context.options.cwd, record.sourcePath),
    sourceLabel: record.sourceLabel,
    text: record.text,
    chunkIndex: record.chunkIndex,
    paperId: typeof meta.paperId === "string" ? meta.paperId : undefined,
    sourceUrl: typeof meta.sourceUrl === "string" ? meta.sourceUrl : undefined,
    wechatStyleVariant:
      typeof meta.wechatStyleVariant === "string" ?
        (meta.wechatStyleVariant as TextChunk["wechatStyleVariant"])
      : undefined,
    wechatStyleSource:
      typeof meta.wechatStyleSource === "string" ?
        (meta.wechatStyleSource as TextChunk["wechatStyleSource"])
      : undefined,
    wechatStyleGenre:
      typeof meta.wechatStyleGenre === "string" ?
        (meta.wechatStyleGenre as TextChunk["wechatStyleGenre"])
      : undefined,
    wechatStyleTask:
      typeof meta.wechatStyleTask === "string" ?
        (meta.wechatStyleTask as TextChunk["wechatStyleTask"])
      : undefined,
    wechatContentSlot:
      typeof meta.wechatContentSlot === "string" ?
        (meta.wechatContentSlot as TextChunk["wechatContentSlot"])
      : undefined,
    wechatCaptionKind:
      typeof meta.wechatCaptionKind === "string" ?
        (meta.wechatCaptionKind as TextChunk["wechatCaptionKind"])
      : undefined,
    kbWechatId: typeof meta.kbWechatId === "string" ? meta.kbWechatId : undefined,
    sectionType: typeof meta.sectionType === "string" ? meta.sectionType : undefined,
    sectionPriority:
      typeof meta.sectionPriority === "string" ? (meta.sectionPriority as TextChunk["sectionPriority"]) : undefined,
  };
}

function writeManifest(context: KnowledgeImporterContext): string {
  const manifestDir = resolve(context.options.cwd, "data/knowledge/import-manifests");
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(
    manifestDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}__${context.source}.json`,
  );
  const payload = {
    importedAt: new Date().toISOString(),
    source: context.source,
    inputPath: context.inputPath,
    collection: context.collection,
    mode: context.mode,
    dryRun: Boolean(context.options.dryRun),
    skipVerify: Boolean(context.options.skipVerify),
    outputStorePath: context.outputStorePath,
    documentCount: context.normalizedDocumentCount ?? context.documents.length,
    chunkRecordCount: context.chunkRecordCount ?? context.chunkRecords.length,
    files: context.documents.map((doc) => ({
      sourceId: doc.sourceId,
      sourcePath: doc.sourcePath,
      title: doc.title,
    })),
  };
  writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return manifestPath;
}

function mergeByUpsertingSourceIds(
  existing: VectorStoreFile | null,
  incoming: StoredVectorChunk[],
): VectorStoreFile {
  const removeKeys = new Set(
    incoming.map((chunk) => `${chunk.collection}::${chunk.sourceId ?? chunk.id}`),
  );
  const kept =
    existing?.chunks.filter(
      (chunk) => !removeKeys.has(`${chunk.collection}::${chunk.sourceId ?? chunk.id}`),
    ) ?? [];
  return {
    version: 1,
    embeddingModel: getEmbeddingModel(),
    createdAt: new Date().toISOString(),
    chunks: [...kept, ...incoming],
  };
}

function verifyStored(context: KnowledgeImporterContext, store: VectorStoreFile): void {
  const expected = new Set(
    context.storedTextChunks.map((chunk) => `${chunk.collection}::${chunk.sourceId ?? chunk.id}`),
  );
  const actual = new Set(
    store.chunks.map((chunk) => `${chunk.collection}::${chunk.sourceId ?? chunk.id}`),
  );
  for (const key of expected) {
    if (!actual.has(key)) {
      throw new Error(`写库校验失败，未找到 source key: ${key}`);
    }
  }
}

async function writeStore(context: KnowledgeImporterContext): Promise<VectorStoreFile> {
  const textChunks = context.chunkRecords.map((record) => toTextChunk(context, record));
  const client = createEmbeddingClient();
  const stored = await embedTextChunks(client, textChunks);
  const existing = loadRagStoreOrLegacy();

  if (context.mode === "append") {
    return {
      version: 1,
      embeddingModel: getEmbeddingModel(),
      createdAt: new Date().toISOString(),
      chunks: [...(existing?.chunks ?? []), ...stored],
    };
  }
  if (context.mode === "upsert-by-source-id") {
    return mergeByUpsertingSourceIds(existing, stored);
  }
  const replaceCollections = [...new Set(stored.map((chunk) => chunk.collection))];
  return buildMergedStore(replaceCollections, stored);
}

export const segmentChunksToStoreStage: KnowledgeImporterStage = {
  name: "segment-chunks-to-store",
  async run(context) {
    if (context.chunkRecords.length === 0) {
      throw new Error("无可写入知识库的 chunk records。");
    }

    const storedTextChunks = context.chunkRecords.map((record) => toTextChunk(context, record));
    let next: KnowledgeImporterContext = {
      ...context,
      storedTextChunks,
      outputStorePath: DEFAULT_RAG_STORE_PATH,
    };

    if (context.options.dryRun) {
      const manifestPath = writeManifest(next);
      next = appendKnowledgeImporterNote(
        {
          ...next,
          manifestPath,
        },
        `segment-chunks-to-store: dry-run staged ${context.chunkRecords.length} chunk record(s) for collection ${context.collection}.`,
      );
      return appendKnowledgeImporterNote(
        next,
        "segment-chunks-to-store: dry-run enabled, embedding/store write not executed yet.",
      );
    }

    const store = await writeStore(next);
    mkdirSync(resolve(context.options.cwd, "data/knowledge"), { recursive: true });
    saveVectorStore(DEFAULT_RAG_STORE_PATH, store);

    if (!context.options.skipVerify) {
      verifyStored(next, store);
    }

    const manifestPath = writeManifest({
      ...next,
      vectorStore: store,
    });

    next = {
      ...next,
      vectorStore: store,
      manifestPath,
    };
    next = appendKnowledgeImporterNote(
      next,
      `segment-chunks-to-store: wrote ${context.chunkRecords.length} chunk record(s) into ${DEFAULT_RAG_STORE_PATH} using mode ${context.mode}.`,
    );
    if (context.options.skipVerify) {
      next = appendKnowledgeImporterNote(
        next,
        "segment-chunks-to-store: verify skipped by option.",
      );
    } else {
      next = appendKnowledgeImporterNote(
        next,
        "segment-chunks-to-store: write verified against rag store.",
      );
    }
    if (!existsSync(DEFAULT_RAG_STORE_PATH)) {
      throw new Error(`写库后未找到 rag store: ${DEFAULT_RAG_STORE_PATH}`);
    }
    return next;
  },
};
