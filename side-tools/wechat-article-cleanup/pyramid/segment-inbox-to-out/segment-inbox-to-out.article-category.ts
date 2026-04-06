import type { WechatArticleCategory } from "../stage-shared.js";

function normalizedText(title?: string, body?: string): string {
  return `${title ?? ""}\n${body ?? ""}`.replace(/\s+/g, " ").trim();
}

export function detectWechatArticleCategory(
  title: string | undefined,
  body: string,
): WechatArticleCategory {
  const t = normalizedText(title, body);
  if (/会议|年会|大会|ASCO|ESMO|AACR|论坛/.test(t)) return "conference_news";
  if (/招募|报名|课程|训练营|直播|讲堂|公开课/.test(t)) {
    return "recruitment_or_course";
  }
  if (/活动|峰会|沙龙|报名开启|邀您/.test(t)) return "activity_promo";
  if (/专家|专访|述评|点评|观点/.test(t)) return "expert_viewpoint";
  if (/盘点|汇总|一文读懂|合集|总览/.test(t)) return "roundup";
  if (/最新研究|研究显示|Nature|Cell|Science|JAMA|NEJM|BMJ|柳叶刀|子刊|doi|PMID/i.test(t)) {
    return "literature_digest";
  }
  if (/获批|新药|指南|临床|患者|试验|研究/.test(t)) return "clinical_news";
  return "generic_article";
}
