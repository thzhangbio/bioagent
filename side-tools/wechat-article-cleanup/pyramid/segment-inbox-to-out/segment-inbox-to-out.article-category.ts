import type { WechatArticleCategory } from "../stage-shared.js";

function normalizedText(text?: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const LITERATURE_TITLE_MARKERS =
  /最新研究|研究显示|研究发现|这项研究|该研究|Nature|Cell|Science|JAMA|NEJM|BMJ|PNAS|柳叶刀|Lancet|子刊|doi|PMID|队列|随访|试验|测序|外显子组|全基因组|Meta|综述/i;

const CONFERENCE_TITLE_MARKERS = /会议|年会|大会|ASCO|ESMO|AACR|论坛/;
const RECRUITMENT_TITLE_MARKERS = /招募|报名|课程|训练营|直播|讲堂|公开课/;
const ACTIVITY_TITLE_MARKERS = /峰会|沙龙|报名开启|邀您/;
const EXPERT_TITLE_MARKERS = /专家|专访|述评|点评|观点/;
const ROUNDUP_TITLE_MARKERS = /盘点|汇总|一文读懂|合集|总览/;
const CLINICAL_NEWS_MARKERS = /获批|新药|指南|临床|患者|试验|研究/;
const LITERATURE_BODY_MARKERS =
  /et al\.|PMID|doi|Front\.|Pharmacol\.|研究方法|方法学|文献综述|系统分析|离散选择实验|全外显子组|多准则决策分析|MCDA|ISPOR/i;

function looksLikeLiteratureDigest(titleText: string, fullText: string): boolean {
  if (LITERATURE_TITLE_MARKERS.test(titleText)) return true;
  if (/Nature|Cell|Science|JAMA|NEJM|BMJ|PNAS|柳叶刀|Lancet|子刊|doi|PMID/i.test(fullText)) {
    return true;
  }
  return LITERATURE_BODY_MARKERS.test(fullText);
}

export function detectWechatArticleCategory(
  title: string | undefined,
  body: string,
): WechatArticleCategory {
  const titleText = normalizedText(title);
  const fullText = `${titleText}\n${normalizedText(body)}`.trim();

  // 当前梅斯 39 篇样本全部是文献解读，优先用标题里的期刊/研究线索兜底，
  // 避免正文中的“活动 / 观点 / 公开课”等普通词把整篇误分到其他文体。
  if (looksLikeLiteratureDigest(titleText, fullText)) {
    return "literature_digest";
  }

  if (CONFERENCE_TITLE_MARKERS.test(titleText)) return "conference_news";
  if (RECRUITMENT_TITLE_MARKERS.test(titleText)) {
    return "recruitment_or_course";
  }
  if (ACTIVITY_TITLE_MARKERS.test(titleText)) return "activity_promo";
  if (EXPERT_TITLE_MARKERS.test(titleText)) return "expert_viewpoint";
  if (ROUNDUP_TITLE_MARKERS.test(titleText)) return "roundup";
  if (CLINICAL_NEWS_MARKERS.test(fullText)) return "clinical_news";
  return "generic_article";
}
