import type { ContentCreateCardSession } from "./content-create-card-session.js";

/** 将卡片表单值转为成稿用的自然语言 + 结构化摘要 */
export function formValuesToWriterBrief(
  session: ContentCreateCardSession,
  formValue: Record<string, string | undefined>,
): string {
  const lines: string[] = [];

  const aud = formValue.cc_audience ?? "public";
  lines.push(
    `【受众】${aud === "hcp" ? "医疗专业人士（HCP）" : "大众 / 患者科普"}`,
  );

  const del = formValue.cc_deliverable ?? "draft";
  lines.push(
    `【稿型】${del === "final" ? "对外终稿" : "内审草稿（合规可后置）"}`,
  );

  const brand = formValue.cc_brand_stance ?? "generic";
  const brandText =
    brand === "no_brand" ? "不出现具体商品名"
    : brand === "generic" ? "通用名/机制表述，谨慎合规"
    : "可适度点名（审慎合规）";
  lines.push(`【品牌/品名策略】${brandText}`);

  const voice = formValue.cc_voice ?? "kol";
  const voiceText =
    voice === "kol" ? "KOL / 种草感叙事"
    : voice === "institution" ? "机构科普口吻"
    : "中立第三方";
  lines.push(`【叙事身份】${voiceText}`);

  const delg = formValue.cc_delegate ?? "yes";
  lines.push(
    `【其余细节】${delg === "yes" ? "已由编辑按上述原则默认处理，不再逐项追问" : "用户可能继续在聊天中补充"}`,
  );

  for (const d of session.dynamicFields) {
    const v = formValue[d.id];
    if (!v) continue;
    const opt = d.options.find((o) => o.value === v);
    lines.push(`【${d.title}】${opt?.label ?? v}`);
  }

  lines.push("");
  lines.push(
    "以上参数由用户在飞书交互卡片中确认；请严格按此成稿，勿再展开同类追问。",
  );

  return lines.join("\n");
}
