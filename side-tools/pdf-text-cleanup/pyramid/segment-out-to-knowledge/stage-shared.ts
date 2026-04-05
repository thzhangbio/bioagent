export const SEGMENT_OUT_TO_KNOWLEDGE_STAGE_NAMES = [
  "00-pre-out-check",
  "01-copy-to-knowledge",
  "02-metadata-id",
  "03-ingest-index",
  "04-verify-search",
  "05-mark-ready-archive",
] as const;

export type SegmentOutToKnowledgeStageName =
  (typeof SEGMENT_OUT_TO_KNOWLEDGE_STAGE_NAMES)[number];

export interface SegmentOutToKnowledgeOptions {
  argv: string[];
  cwd: string;
  invokedFromCli: boolean;
  outDir?: string;
  knowledgeDir?: string;
  skipCopy?: boolean;
  skipIngest?: boolean;
}

export interface SegmentOutToKnowledgeFileRecord {
  fileName: string;
  outPath: string;
  knowledgePath?: string;
  doi: string | null;
  slug: string;
}

export interface SegmentOutToKnowledgeContext {
  options: SegmentOutToKnowledgeOptions;
  stageOrder: SegmentOutToKnowledgeStageName[];
  completedStages: SegmentOutToKnowledgeStageName[];
  notes: string[];
  outDirPath?: string;
  knowledgeDirPath?: string;
  outFiles: SegmentOutToKnowledgeFileRecord[];
  copiedFiles: SegmentOutToKnowledgeFileRecord[];
  manifestPath?: string;
  ragStorePath?: string;
}

export interface SegmentOutToKnowledgeStage {
  name: SegmentOutToKnowledgeStageName;
  run: (
    context: SegmentOutToKnowledgeContext,
  ) => Promise<SegmentOutToKnowledgeContext> | SegmentOutToKnowledgeContext;
}

export function createSegmentOutToKnowledgeContext(
  options: SegmentOutToKnowledgeOptions,
): SegmentOutToKnowledgeContext {
  return {
    options,
    stageOrder: [...SEGMENT_OUT_TO_KNOWLEDGE_STAGE_NAMES],
    completedStages: [],
    notes: [],
    outFiles: [],
    copiedFiles: [],
  };
}

export function appendSegmentOutToKnowledgeNote(
  context: SegmentOutToKnowledgeContext,
  note: string,
): SegmentOutToKnowledgeContext {
  return {
    ...context,
    notes: [...context.notes, note],
  };
}

export function markSegmentOutToKnowledgeStageComplete(
  context: SegmentOutToKnowledgeContext,
  stageName: SegmentOutToKnowledgeStageName,
): SegmentOutToKnowledgeContext {
  return {
    ...context,
    completedStages: [...context.completedStages, stageName],
  };
}

