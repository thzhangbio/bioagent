export const SEGMENT_INBOX_TO_OUT_STAGE_NAMES = [
  "00-entry-routing",
  "01-read-validate",
  "02-structure-json",
  "03-mineru-preliminary",
  "04-layout-flow",
  "05-headers-footers-pages",
  "06-tables-blocks",
  "07-cleanup-generic",
  "08-cleanup-kb-specific",
  "09-formula-fragments",
  "10-metadata-fetch",
  "11-quality-gate",
  "12-write-final",
  "13-inbox-sync",
] as const;

export type SegmentInboxToOutStageName =
  (typeof SEGMENT_INBOX_TO_OUT_STAGE_NAMES)[number];

export interface SegmentInboxToOutArchiveNameParts {
  timestamp?: string;
  slug?: string;
  doiSegment?: string;
}

export interface SegmentInboxToOutOptions {
  argv: string[];
  cwd: string;
  invokedFromCli: boolean;
  rawMd?: string;
  jsonPath?: string;
  out?: string;
  keepStructureManifest?: boolean;
  alsoSimpleOut?: boolean;
  noRenameInbox?: boolean;
  noCrossref?: boolean;
  noEuropepmc?: boolean;
}

export interface SegmentInboxToOutContext {
  options: SegmentInboxToOutOptions;
  stageOrder: SegmentInboxToOutStageName[];
  completedStages: SegmentInboxToOutStageName[];
  notes: string[];
  rawMdPath?: string;
  jsonPath?: string;
  rawMdText?: string;
  rawJson?: unknown;
  preliminaryMd?: string;
  structureSection?: string;
  workingBody?: string;
  cleanedBody?: string;
  finalMd?: string;
  archiveNameParts?: SegmentInboxToOutArchiveNameParts;
  primaryOutPath?: string;
  renamedInboxPaths: string[];
  simpleOutPath?: string;
  outDirPath?: string;
}

export interface SegmentInboxToOutStage {
  name: SegmentInboxToOutStageName;
  run: (
    context: SegmentInboxToOutContext,
  ) => Promise<SegmentInboxToOutContext> | SegmentInboxToOutContext;
}

export function createSegmentInboxToOutContext(
  options: SegmentInboxToOutOptions,
): SegmentInboxToOutContext {
  return {
    options,
    stageOrder: [...SEGMENT_INBOX_TO_OUT_STAGE_NAMES],
    completedStages: [],
    notes: [],
    renamedInboxPaths: [],
  };
}

export function appendSegmentInboxToOutNote(
  context: SegmentInboxToOutContext,
  note: string,
): SegmentInboxToOutContext {
  return {
    ...context,
    notes: [...context.notes, note],
  };
}

export function markSegmentInboxToOutStageComplete(
  context: SegmentInboxToOutContext,
  stageName: SegmentInboxToOutStageName,
): SegmentInboxToOutContext {
  return {
    ...context,
    completedStages: [...context.completedStages, stageName],
  };
}
