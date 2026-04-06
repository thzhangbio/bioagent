import type { KnowledgeCollection, TextChunk, VectorStoreFile } from "../../../src/knowledge/types.js";

export const KNOWLEDGE_IMPORTER_STAGE_NAMES = [
  "segment-load-to-normalized",
  "segment-normalized-to-chunks",
  "segment-chunks-to-store",
] as const;

export type KnowledgeImporterStageName =
  (typeof KNOWLEDGE_IMPORTER_STAGE_NAMES)[number];

export type KnowledgeImportCommand = "run";

export type KnowledgeImportSource =
  | "literature_kb"
  | "wechat_style"
  | "presets"
  | "job_posts";

export type KnowledgeImportMode =
  | "replace-collection"
  | "append"
  | "upsert-by-source-id";

export interface ImportDocument {
  source: KnowledgeImportSource;
  sourcePath: string;
  sourceId: string;
  title: string;
  collection: KnowledgeCollection;
  body: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

export interface ImportChunkRecord {
  id: string;
  source: KnowledgeImportSource;
  sourceId: string;
  collection: KnowledgeCollection;
  sourcePath: string;
  sourceLabel: string;
  chunkIndex: number;
  text: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

export interface KnowledgeImporterOptions {
  argv: string[];
  cwd: string;
  command: KnowledgeImportCommand;
  source: string;
  input?: string;
  collection?: string;
  mode?: string;
  skipVerify?: boolean;
  dryRun?: boolean;
}

export interface KnowledgeImporterContext {
  options: KnowledgeImporterOptions;
  stageOrder: KnowledgeImporterStageName[];
  completedStages: KnowledgeImporterStageName[];
  notes: string[];
  source: KnowledgeImportSource;
  inputPath?: string;
  collection: KnowledgeCollection;
  mode: KnowledgeImportMode;
  documents: ImportDocument[];
  chunkRecords: ImportChunkRecord[];
  storedTextChunks: TextChunk[];
  normalizedDocumentCount?: number;
  chunkRecordCount?: number;
  manifestPath?: string;
  outputStorePath?: string;
  vectorStore?: VectorStoreFile;
}

export interface KnowledgeImporterStage {
  name: KnowledgeImporterStageName;
  run: (
    context: KnowledgeImporterContext,
  ) => Promise<KnowledgeImporterContext> | KnowledgeImporterContext;
}

function resolveSource(raw: string): KnowledgeImportSource {
  if (
    raw === "literature_kb" ||
    raw === "wechat_style" ||
    raw === "presets" ||
    raw === "job_posts"
  ) {
    return raw;
  }
  throw new Error(`不支持的 source: ${raw}`);
}

function resolveMode(raw?: string): KnowledgeImportMode {
  if (
    raw === undefined ||
    raw === "" ||
    raw === "replace-collection" ||
    raw === "append" ||
    raw === "upsert-by-source-id"
  ) {
    return raw || "replace-collection";
  }
  throw new Error(`不支持的 mode: ${raw}`);
}

function defaultCollection(source: KnowledgeImportSource): KnowledgeCollection {
  switch (source) {
    case "literature_kb":
      return "literature";
    case "wechat_style":
      return "wechat_style";
    case "presets":
      return "platform_tone";
    case "job_posts":
      return "job_post";
  }
}

function resolveCollection(
  raw: string | undefined,
  source: KnowledgeImportSource,
): KnowledgeCollection {
  const value = raw ?? defaultCollection(source);
  if (
    value === "job_post" ||
    value === "platform_tone" ||
    value === "medical" ||
    value === "personal" ||
    value === "literature" ||
    value === "wechat_style"
  ) {
    return value;
  }
  throw new Error(`不支持的 collection: ${value}`);
}

export function createKnowledgeImporterContext(
  options: KnowledgeImporterOptions,
): KnowledgeImporterContext {
  const source = resolveSource(options.source);
  return {
    options,
    stageOrder: [...KNOWLEDGE_IMPORTER_STAGE_NAMES],
    completedStages: [],
    notes: [],
    source,
    collection: resolveCollection(options.collection, source),
    mode: resolveMode(options.mode),
    documents: [],
    chunkRecords: [],
    storedTextChunks: [],
  };
}

export function appendKnowledgeImporterNote(
  context: KnowledgeImporterContext,
  note: string,
): KnowledgeImporterContext {
  return {
    ...context,
    notes: [...context.notes, note],
  };
}

export function markKnowledgeImporterStageComplete(
  context: KnowledgeImporterContext,
  stageName: KnowledgeImporterStageName,
): KnowledgeImporterContext {
  return {
    ...context,
    completedStages: [...context.completedStages, stageName],
  };
}
