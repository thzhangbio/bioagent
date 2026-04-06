import type { WechatArticleMeta } from "../shared/wechat-meta.js";
import type {
  WechatArticleCategory,
  WechatRawRecord,
  WechatSourceProfile,
} from "../stage-shared.js";

export const SEGMENT_INBOX_TO_OUT_STAGE_NAMES = [
  "00-entry-routing",
  "01-source-profile",
  "02-article-category",
  "03-structure-blocks",
  "04-markdown-render",
  "05-write-final",
] as const;

export type SegmentInboxToOutStageName =
  (typeof SEGMENT_INBOX_TO_OUT_STAGE_NAMES)[number];

export interface WechatCleanupBlock {
  slot:
    | "title"
    | "lead"
    | "body"
    | "caption"
    | "diversion"
    | "references"
    | "byline"
    | "footer";
  text: string;
}

export interface WechatCleanupDraft {
  rawRecord: WechatRawRecord;
  inboxBaseName: string;
  meta: WechatArticleMeta;
  sourceProfile?: WechatSourceProfile;
  articleCategory?: WechatArticleCategory;
  styleVariant?: string;
  blocks: WechatCleanupBlock[];
  markdownBody?: string;
  outBaseName?: string;
  outMarkdown?: string;
  outPath?: string;
}

export interface SegmentInboxToOutContext {
  cwd: string;
  rootDir: string;
  inboxDirPath: string;
  outDirPath: string;
  stripFooter: boolean;
  fetchStats: boolean;
  deferLiangyi: boolean;
  inputFile?: string;
  rawRecords: WechatRawRecord[];
  drafts: WechatCleanupDraft[];
  notes: string[];
  completedStages: SegmentInboxToOutStageName[];
}

export interface SegmentInboxToOutStage {
  name: SegmentInboxToOutStageName;
  run: (
    context: SegmentInboxToOutContext,
  ) => Promise<SegmentInboxToOutContext> | SegmentInboxToOutContext;
}

export function createSegmentInboxToOutContext(input: {
  cwd: string;
  rootDir: string;
  inboxDirPath: string;
  outDirPath: string;
  stripFooter: boolean;
  fetchStats: boolean;
  deferLiangyi: boolean;
  inputFile?: string;
}): SegmentInboxToOutContext {
  return {
    ...input,
    rawRecords: [],
    drafts: [],
    notes: [],
    completedStages: [],
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
