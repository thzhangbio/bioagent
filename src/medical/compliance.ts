import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "../agent/anthropic.js";

/**
 * Phase D：合规与改稿 — 暂无规则库时，用基座模型做协审提示（非法律意见）。
 * - 宽松闸门：`FEISHU_CONTENT_STRICT_GATE` 未设为 `1` 时，动笔前少追问，合规后置。
 * - 成稿后审读：`FEISHU_COMPLIANCE_AFTER_WRITE=0` 可关闭。
 */

export function isContentStrictGate(): boolean {
  return process.env.FEISHU_CONTENT_STRICT_GATE === "1";
}

export function isComplianceReviewAfterWriteEnabled(): boolean {
  return process.env.FEISHU_COMPLIANCE_AFTER_WRITE !== "0";
}

const REVIEW_SYSTEM = `你是医学新媒体与推广合规方向的**协审助手**（非律师、非最终合规裁决）。
用户文稿为**内审/讨论稿**，可能将经人工修订后再投放。

请通读「标题 + 正文」，只做**风险提示与改写建议**，要求：
- 关注：广告法常见雷区（如绝对化用语）、夸大或未经充分依据的疗效/安全性表述、处方药面向公众的推广风险、引述研究结论是否过度概括等。
- 输出使用 Markdown：**分条**写出；每条含：问题类型或大致位置、说明、**建议**、严重度（高/中/低）。无明显问题时简短说明「未发现明显高风险表述，仍建议人工终审」即可。
- **不要**输出完整正文重抄；不要编造文中未出现的「违规」；语气专业、克制。`;

const MAX_BODY_CHARS = 14_000;

/**
 * 对已成稿标题与正文做一次 LLM 协审（规则库接入前使用）。
 */
export async function reviewDraftWithLlm(
  title: string,
  body: string,
): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const bodySlice =
    body.length > MAX_BODY_CHARS ?
      `${body.slice(0, MAX_BODY_CHARS)}\n\n…（正文过长已截断，审读仅基于以上片段）`
    : body;

  const userBlock = `【标题】\n${title}\n\n【正文】\n${bodySlice}`;

  const res = await getAnthropicClient().messages.create({
    model,
    max_tokens: 2_048,
    system: REVIEW_SYSTEM,
    messages: [{ role: "user", content: userBlock }],
  });

  const text =
    res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || "（模型未返回审读内容。）";

  return text;
}
