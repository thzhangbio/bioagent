export const SEGMENT_OUT_TO_ARCHIVE_STAGE_NAMES = [
  "00-archive-trigger",
  "01-target-paths",
  "02-idempotency",
  "03-move-execute",
  "04-inbox-archive-sidecar",
  "05-audit-log",
] as const;

export type SegmentOutToArchiveStageName =
  (typeof SEGMENT_OUT_TO_ARCHIVE_STAGE_NAMES)[number];

export interface SegmentOutToArchiveOptions {
  argv: string[];
  cwd: string;
  invokedFromCli: boolean;
  mode?: "all" | "out-only" | "inbox-only";
  force?: boolean;
  outDir?: string;
  inboxDir?: string;
  archiveDir?: string;
}

export interface SegmentOutToArchiveContext {
  options: SegmentOutToArchiveOptions;
  stageOrder: SegmentOutToArchiveStageName[];
  completedStages: SegmentOutToArchiveStageName[];
  notes: string[];
  outDirPath?: string;
  inboxDirPath?: string;
  archiveDirPath?: string;
  outTargets: string[];
  inboxTargets: string[];
  manifestPath?: string;
  manifestPayload?: {
    files?: Array<{ outPath?: string }>;
  };
  outArchiveDest?: string;
  inboxArchiveDest?: string;
  auditLogPath?: string;
}

export interface SegmentOutToArchiveStage {
  name: SegmentOutToArchiveStageName;
  run: (
    context: SegmentOutToArchiveContext,
  ) => Promise<SegmentOutToArchiveContext> | SegmentOutToArchiveContext;
}

export function createSegmentOutToArchiveContext(
  options: SegmentOutToArchiveOptions,
): SegmentOutToArchiveContext {
  return {
    options,
    stageOrder: [...SEGMENT_OUT_TO_ARCHIVE_STAGE_NAMES],
    completedStages: [],
    notes: [],
    outTargets: [],
    inboxTargets: [],
  };
}

export function appendSegmentOutToArchiveNote(
  context: SegmentOutToArchiveContext,
  note: string,
): SegmentOutToArchiveContext {
  return {
    ...context,
    notes: [...context.notes, note],
  };
}

export function markSegmentOutToArchiveStageComplete(
  context: SegmentOutToArchiveContext,
  stageName: SegmentOutToArchiveStageName,
): SegmentOutToArchiveContext {
  return {
    ...context,
    completedStages: [...context.completedStages, stageName],
  };
}
