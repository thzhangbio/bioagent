export const WECHAT_CLEANUP_STAGE_NAMES = [
  "segment-links-to-inbox",
  "segment-inbox-to-out",
  "segment-out-to-knowledge",
  "segment-out-to-archive",
] as const;

export type WechatCleanupStageName =
  (typeof WECHAT_CLEANUP_STAGE_NAMES)[number];

export type WechatSourceProfile = "medsci" | "liangyi_hui" | "generic_wechat";

export type WechatArticleCategory =
  | "literature_digest"
  | "clinical_news"
  | "conference_news"
  | "expert_viewpoint"
  | "activity_promo"
  | "recruitment_or_course"
  | "roundup"
  | "generic_article";

export interface WechatCleanupOptions {
  argv: string[];
  cwd: string;
  fetchOnly?: boolean;
  cleanOnly?: boolean;
  stripFooter?: boolean;
  fetchStats?: boolean;
  deferLiangyi?: boolean;
  skipKnowledge?: boolean;
  skipArchive?: boolean;
  inboxOnlyArchive?: boolean;
  outOnlyArchive?: boolean;
  inputFile?: string;
}

export interface WechatRawRecord {
  inboxFileName: string;
  inboxPath: string;
  sourceUrl?: string;
  fetchedAt?: string;
  rawHtml: string;
  contentFormat?: "raw_html" | "clean_markdown";
}

export interface WechatOutRecord {
  inboxPath: string;
  outPath: string;
  outBaseName: string;
  sourceProfile: WechatSourceProfile;
  articleCategory: WechatArticleCategory;
  title?: string;
  mpName?: string;
}

export interface WechatCleanupContext {
  options: WechatCleanupOptions;
  stageOrder: WechatCleanupStageName[];
  completedStages: WechatCleanupStageName[];
  notes: string[];
  linksPath?: string;
  inboxDirPath?: string;
  outDirPath?: string;
  rawRecords: WechatRawRecord[];
  outRecords: WechatOutRecord[];
}

export interface WechatCleanupStage {
  name: WechatCleanupStageName;
  run: (
    context: WechatCleanupContext,
  ) => Promise<WechatCleanupContext> | WechatCleanupContext;
}

export function createWechatCleanupContext(
  options: WechatCleanupOptions,
): WechatCleanupContext {
  return {
    options,
    stageOrder: [...WECHAT_CLEANUP_STAGE_NAMES],
    completedStages: [],
    notes: [],
    rawRecords: [],
    outRecords: [],
  };
}

export function appendWechatCleanupNote(
  context: WechatCleanupContext,
  note: string,
): WechatCleanupContext {
  return {
    ...context,
    notes: [...context.notes, note],
  };
}

export function markWechatCleanupStageComplete(
  context: WechatCleanupContext,
  stageName: WechatCleanupStageName,
): WechatCleanupContext {
  return {
    ...context,
    completedStages: [...context.completedStages, stageName],
  };
}
