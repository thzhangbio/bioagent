/**
 * 从合并后的用户原文中抽取「写作简报」信号，用于：
 * - 闸门与规则：避免重复追问已回答的维度
 * - 强制放行：用户明确「草稿 + 授权编辑」时的协作路径
 * - 回复前缀：让用户感到「有被听到」
 */

function normalizeMergedText(raw: string): string {
  let t = raw.trim();
  t = t.replace(/\u200b/g, "");
  t = t.replace(/<at[^>]*>([^<]*)<\/at>/gi, " ");
  t = t.replace(/@_user_[^\s@]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export interface WriteBriefSignals {
  /** 受众侧：大众/患者/专业人士等 */
  hasAudienceHint: boolean;
  /** 发布侧：账号、主体、资质账户等 */
  hasPublisherHint: boolean;
  /** 品牌/品名是否由编辑决定 */
  delegatedBrand: boolean;
  /** 合规边界是否由编辑把握（含「由你审」「你专业」） */
  delegatedCompliance: boolean;
  /** 明确内审/草稿、先写、合规后置 */
  draftMode: boolean;
  /** 科普/品宣/品牌认知等目的 */
  hasPurposeHint: boolean;
  /** 提及广审/广告审批 */
  hasAdApprovalHint: boolean;
  /** 明确无内部合规流程、交编辑把关 */
  noInternalComplianceButEditorReview: boolean;
}

export function extractWriteBriefSignals(mergedUserText: string): WriteBriefSignals {
  const t = normalizeMergedText(mergedUserText);

  const hasAudienceHint =
    /大众|公众|普通人|科普向|患者|读者|医护|医生|专业人士|医疗人士|面向(?:大众|患者)/.test(
      t,
    );

  const hasPublisherHint =
    /发布主体|账号|署名|良医汇|泰诺麦博|品牌方|甲方|合作方|官方账号|医疗账户|有资质|医疗机构|第三方|矩阵|委托/.test(
      t,
    ) || /对外(?:终稿|发布)?|终稿|公域投放|公开发布|可对外/.test(t);

  const delegatedBrand =
    /品牌(?:名)?(?:由你|你来)|由你(?:定|判断).{0,12}(?:品牌|点名|商品)|能不能(?:直接)?点.*由你|涉不涉及品牌.*由你/.test(
      t,
    );

  const delegatedCompliance =
    /由你(?:定|判断|把握|决定|审|把关|来审)|你专业|你来(?:判断|是否合适)|边界.*你|合规.*由你|没有.{0,8}合规.{0,8}流程.*由你|由你来审核/.test(
      t,
    );

  const draftMode =
    /(?:只是|这)?一篇?草稿|初稿|讨论稿|内审|先写|写完(?:再|之后)|合规.{0,14}(?:等|之后|再来|再谈)|(?:等|之后).{0,8}(?:再)?谈合规|合规(?:方向|细节).{0,6}(?:等|之后)|不对外|仅供内部/.test(
      t,
    );

  const hasPurposeHint =
    /科普|品宣|产品宣传|品牌认知|传播目的|顺带|目的|教育|转化/.test(t);

  const hasAdApprovalHint = /广告审批|广审|批文|批准文号|有审批/.test(t);

  const noInternalComplianceButEditorReview =
    /没有.{0,10}合规.{0,10}(?:审核|流程)|无.{0,6}内审|跳过.{0,6}法务/.test(t) &&
    /由你(?:审|把关|审核)/.test(t);

  return {
    hasAudienceHint,
    hasPublisherHint,
    delegatedBrand,
    delegatedCompliance,
    draftMode,
    hasPurposeHint,
    hasAdApprovalHint,
    noInternalComplianceButEditorReview,
  };
}

/**
 * 用户已明确：草稿/内审 + 编辑授权 + 受众与发布侧已有信息 → 不再挡闸门（与模型 READY 对齐）。
 */
export function shouldForceReadyForDraftCollaboration(
  mergedUserText: string,
): boolean {
  const s = extractWriteBriefSignals(mergedUserText);
  const t = normalizeMergedText(mergedUserText);

  if (process.env.FEISHU_CONTENT_FORCE_GATE === "1") {
    return false;
  }

  if (!s.draftMode) return false;
  if (!s.delegatedCompliance && !s.delegatedBrand) return false;
  if (!s.hasAudienceHint) return false;
  if (!s.hasPublisherHint && !/小红书|公众号|知乎/.test(t)) return false;

  return true;
}

/**
 * 用户已充分授权且材料齐（受众、主体/资质、目的、广审、品牌与合规均交编辑）：允许直接成稿（不必再等「草稿」二字）。
 */
export function shouldForceReadyForEditorHandoff(
  mergedUserText: string,
): boolean {
  const s = extractWriteBriefSignals(mergedUserText);
  const t = normalizeMergedText(mergedUserText);

  if (process.env.FEISHU_CONTENT_FORCE_GATE === "1") {
    return false;
  }

  if (!s.hasAudienceHint || !s.hasPublisherHint) return false;
  if (!s.delegatedCompliance || !s.delegatedBrand) return false;
  if (!s.hasPurposeHint) return false;
  if (!s.hasAdApprovalHint) return false;
  if (!/(?:小红书|小红薯)/.test(t)) return false;

  return true;
}

/**
 * 草稿协作：用户已多轮补充仍坚持先出稿时，放宽「一句话里必须含齐三要素」的机械拦截。
 */
export function shouldRelaxXhsOverride(mergedUserText: string): boolean {
  const s = extractWriteBriefSignals(mergedUserText);
  return (
    s.draftMode &&
    s.delegatedCompliance &&
    s.hasAudienceHint &&
    (s.hasPublisherHint || s.hasAdApprovalHint)
  );
}

/**
 * 注入闸门与正文的结构化摘要，减少模型忽略用户已述事实。
 */
export function buildBriefSummaryBlock(mergedUserText: string): string {
  const s = extractWriteBriefSignals(mergedUserText);
  const lines: string[] = ["【从用户原话中读取的要点（须优先承认，勿重复追问已覆盖项）】"];

  if (s.hasAudienceHint) lines.push("- 已提及受众/读者侧信息（大众或专业人士等）。");
  if (s.hasPublisherHint) lines.push("- 已提及发布侧/账号/主体或资质相关信息。");
  if (s.delegatedBrand) lines.push("- 用户将是否点名品牌/商品交由编辑判断。");
  if (s.delegatedCompliance) lines.push("- 用户将合规与表述尺度交由编辑把握。");
  if (s.draftMode) lines.push("- 用户明确本篇可先出稿、合规或细节可后置讨论（内审/草稿取向）。");
  if (s.hasPurposeHint) lines.push("- 已提及传播目的（科普/品宣/品牌认知等）。");
  if (s.hasAdApprovalHint) lines.push("- 用户提及广告审批/广审相关。");
  if (s.noInternalComplianceButEditorReview) {
    lines.push("- 用户表示内部合规流程有限，由编辑侧把关表述风险。");
  }

  if (lines.length === 1) {
    lines.push("（未抽取到结构化要点，请以原文为准。）");
  }

  return lines.join("\n");
}

/**
 * 追问回复前缀：简短回扣，增强对话感。
 */
export function buildBriefAcknowledgmentPreamble(
  mergedUserText: string,
): string {
  const s = extractWriteBriefSignals(mergedUserText);
  const parts: string[] = [];

  if (s.hasAudienceHint && s.hasPurposeHint) {
    parts.push("已记下：本篇面向与目的你这边说过，我按科普/品宣边界来把握表述。");
  } else if (s.hasAudienceHint) {
    parts.push("已记下受众方向。");
  }

  if (s.delegatedBrand || s.delegatedCompliance) {
    parts.push("品牌与合规尺度按你授权由我来判断，成稿里会用审慎表述。");
  }

  if (s.draftMode) {
    parts.push("按「先出讨论稿、合规再对齐」处理。");
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join("");
}
