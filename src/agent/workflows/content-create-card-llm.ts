import Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "../anthropic.js";

export interface CardSelectOption {
  label: string;
  value: string;
}

/** 模型生成的「非常规」维度（最多 3 项），每项为选择题 */
export interface DynamicCardField {
  id: string;
  /** 题目标题（短） */
  title: string;
  /** 3～4 个选项 + 可含「其他」 */
  options: CardSelectOption[];
  /** 根据用户首句建议的 value，仅作 UI 提示用 */
  suggestedValue?: string;
}

const DYNAMIC_MAX = 3;

const SPEC_SYSTEM = `你是医学新媒体编辑助手。用户会提出「写一篇…（平台）…」类任务，你需要**仅输出一个 JSON 对象**（不要 markdown 代码块），用于飞书卡片上的「补充确认项」。

要求：
- 数组 \`dynamic\` **最多 ${DYNAMIC_MAX} 条**；若首句信息已足够、没有关键缺口，\`dynamic\` 可为空数组。
- 每条包含：\`id\`（英文蛇形，如 rx_brand）、\`title\`（≤20字的中文标题）、\`options\`（3～4 项，每项 \`label\` 中文短句、\`value\` 英文蛇形）、可选 \`suggestedValue\`（必须与某一 option 的 value 一致，表示根据用户首句的推荐）。
- 题目应针对**仍可能影响成稿**的点（如处方药表述边界、种草强度、是否对比传统制剂），**不要**重复问受众/平台若首句已明确。
- 禁止输出首句已回答的问题。

JSON 形状严格如下：
{"dynamic":[{"id":"string","title":"string","options":[{"label":"string","value":"string"}],"suggestedValue":"string?"}]}`;

/**
 * 根据用户首句一次性生成「非常规」卡片题目（最多 3 个选择题）。
 */
export async function generateDynamicCardFields(
  userFirstMessage: string,
): Promise<DynamicCardField[]> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  try {
    const res = await getAnthropicClient().messages.create({
      model,
      max_tokens: 1200,
      system: SPEC_SYSTEM,
      messages: [
        {
          role: "user",
          content: `用户首句任务：\n${userFirstMessage.trim()}\n\n只输出 JSON。`,
        },
      ],
    });
    const text =
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { dynamic?: unknown };
    const arr = Array.isArray(parsed.dynamic) ? parsed.dynamic : [];
    const out: DynamicCardField[] = [];
    for (const item of arr.slice(0, DYNAMIC_MAX)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = String(o.id ?? "").replace(/[^a-z0-9_]/gi, "_");
      const title = String(o.title ?? "").slice(0, 24);
      const optionsRaw = Array.isArray(o.options) ? o.options : [];
      const options: CardSelectOption[] = [];
      for (const opt of optionsRaw.slice(0, 5)) {
        if (!opt || typeof opt !== "object") continue;
        const op = opt as Record<string, unknown>;
        const label = String(op.label ?? "").slice(0, 40);
        const value = String(op.value ?? "").slice(0, 40);
        if (label && value) options.push({ label, value });
      }
      if (!id || !title || options.length < 2) continue;
      const suggested =
        typeof o.suggestedValue === "string" ? o.suggestedValue : undefined;
      out.push({
        id: `dyn_${id}`,
        title,
        options,
        suggestedValue: suggested,
      });
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-create-card-llm] 动态项生成失败:", msg);
    return [];
  }
}
