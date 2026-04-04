import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "../anthropic.js";
import {
  fetchContentRagContext,
  formatProfileBlock,
  isWriteTaskIntent,
  normalizeUserTextForIntent,
  splitGeneratedTitleAndBody,
  stripAssistantNoise,
} from "./content-create.js";
import {
  buildDocxWebUrl,
  getDocumentPlainText,
  replaceDocumentPagePlainText,
} from "../../lark/docx-document.js";
import {
  isComplianceReviewAfterWriteEnabled,
  reviewDraftWithLlm,
} from "../../medical/compliance.js";
import { loadMemory, saveMemory, type MemoryStore } from "../../memory/store.js";

const DOCX_REVISE_SYSTEM = `你是医学新媒体编辑。用户要求**修改**一篇已存在的稿件正文（已通过飞书新版云文档交付）。

要求：
- **输出结构（必须严格遵守）**：
  - 第 1 行：**仅一行**——修改后的**发布标题**（若用户未要求改标题，保持原标题或只做必要微调）。
  - 第 2 行：必须为空行。
  - 第 3 行起：**正文**，段落之间空一行；正文内不要重复第一行的标题；不要使用 Markdown 标题符号（如 #）。
- **以【当前文档正文】为事实基底**；用户指令与知识库片段用于语气、结构、合规与补充；**禁止编造**新数据、病例或文献结论；不确定处用审慎表述或删去。
- 医学表述审慎，不夸大疗效；遵守广告法，避免绝对化用语。
- 不要开场白或后记说明；不要输出「已保存」等系统话术。`;

/** 从消息中提取飞书 docx 的 document_id（URL 路径 `/docx/<token>`） */
export function extractDocxDocumentIdFromText(raw: string): string | null {
  const m =
    raw.match(/\/docx\/([a-zA-Z0-9_-]+)/) ??
    raw.match(/larkoffice\.com\/docx\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/**
 * 是否走「聊天改稿并写回飞书云文档」工作流（需在路由层配合 lastDeliveredDoc 或 URL 中的 document_id）。
 */
export function isDocxReviseIntent(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 4) return false;
  if (isWriteTaskIntent(t)) return false;
  if (/^(?:什么|怎么|如何|为什么|是否|能否|可不可以|要不要)/u.test(t)) {
    return false;
  }

  const hasReviseVerb =
    /改稿|改一下|改改|改成|改为|润色|删改|修改|调整|缩短|加长|优化|重写|修订|更新|精简|扩写|口语化|专业化|去AI味|更正式|更活泼|替换|删掉|加上|写回|同步到/u.test(
      t,
    );
  if (!hasReviseVerb) return false;

  const mentionsContext =
    /文档|云文档|飞书|docx|那篇|上一篇|刚写的|成稿|这篇|这段|那段|段落|交付稿|链接里|刚发|刚给你/u.test(
      t,
    ) || /docx\/[a-zA-Z0-9_-]+/u.test(userText);

  const shortStandalone =
    t.length <= 48 &&
    /^(?:请|麻烦|帮我)?(?:润色|改一下|优化|修改|调整)(?:下|一下)?[。.!！？\s]*$/u.test(t);

  return mentionsContext || shortStandalone;
}

/**
 * 在已有「最近交付文档」时，放宽识别「改语气/改段」等短句；要求**与稿件/段落相关**，避免与「修改公司信息」等记忆对话冲突。
 */
export function shouldRunDocxReviseHeuristic(
  userText: string,
  hasLastDeliveredDoc: boolean,
): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (!hasLastDeliveredDoc || t.length < 4) return false;
  if (isWriteTaskIntent(t)) return false;
  if (/^(?:什么|怎么|如何|为什么|是否|能否)/u.test(t)) return false;
  const docCue =
    /稿|正文|文档|那段|这段|段落|标题|导语|开头|结尾|句子|语气|版本|云文档|飞书|笔记|文章|文案/u.test(t);
  const strongRevise =
    /润色|缩短|加长|扩写|精简|口语化|专业化|去AI味|更正式|更活泼|改稿|重写|修订|删改/u.test(t);
  const weakVerb = /修改|调整|优化|替换|删掉|加上|更新/u.test(t) && docCue;
  return strongRevise || weakVerb;
}

export interface DocxReviseWorkflowOptions {
  senderOpenId?: string;
}

/**
 * 读取最近一次交付或链接中的 docx → 检索 → Claude 改稿 → 写回页面正文。
 */
export async function runDocxReviseWorkflow(
  _chatId: string,
  userText: string,
  workflowOpts: DocxReviseWorkflowOptions = {},
): Promise<string> {
  void _chatId;
  void workflowOpts;

  const memory = loadMemory();
  const fromUrl = extractDocxDocumentIdFromText(userText);
  const documentId = fromUrl ?? memory.lastDeliveredDoc?.documentId;

  if (!documentId) {
    return [
      "未找到可改稿的云文档：请先发一条包含 **飞书 docx 链接**（路径里带 `/docx/文档ID`）的消息，或先让我完成一篇并交付到飞书后再说「改一下」类指令。",
      "",
      "（若你刚在本对话中成稿，我会默认改**最近一篇**已交付的文档。）",
    ].join("\n");
  }

  let plain: string;
  try {
    plain = await getDocumentPlainText(documentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[docx-revise] 读取正文失败:", msg);
    return [
      "无法读取该云文档正文（请确认应用已开通 docx 相关权限，且文档对应用可见）。",
      "",
      `错误摘要：${msg.slice(0, 220)}`,
    ].join("\n");
  }

  if (!plain.trim()) {
    return "该文档当前为空或无法解析正文，请先确认文档内容后再试。";
  }

  const ragQuery = [
    userText.trim(),
    "",
    "---",
    "",
    "当前文档摘录（用于检索术语与禁忌）：",
    plain.slice(0, 1800),
  ].join("\n");

  const ragBlock = await fetchContentRagContext(ragQuery);
  const profileBlock = formatProfileBlock(memory);

  const userPayload = [
    "【用户改稿指令】",
    userText.trim(),
    "",
    "【公司画像】",
    profileBlock,
    "",
    "【知识库参考（改稿前检索）】",
    ragBlock,
    "",
    "【当前文档正文（完整）】",
    plain,
  ].join("\n");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  let body: string;
  let title: string;
  try {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 4096,
      system: DOCX_REVISE_SYSTEM,
      messages: [{ role: "user", content: userPayload }],
    });
    const rawBody =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "";
    const cleaned = stripAssistantNoise(rawBody);
    const split = splitGeneratedTitleAndBody(cleaned, userText);
    body = split.body;
    title = split.title;
    if (!body.trim()) {
      throw new Error("模型未返回正文");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[docx-revise] Claude 改稿失败:", msg);
    if (msg.includes("401") || msg.includes("auth")) {
      return "抱歉，模型身份凭证异常，请检查 ANTHROPIC_API_KEY。";
    }
    return `抱歉，改稿生成失败：${msg.slice(0, 200)}`;
  }

  try {
    await replaceDocumentPagePlainText(documentId, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[docx-revise] 写回飞书失败:", msg);
    return [
      "改稿内容已生成，但**未能写入飞书云文档**（网络/权限/版本冲突等）。",
      "",
      `错误摘要：${msg.slice(0, 240)}`,
      "",
      "请稍后重试，或检查开放平台中文档权限与 docx 相关 scope。",
    ].join("\n");
  }

  const url = buildDocxWebUrl(documentId);
  const fresh = loadMemory();
  if (fresh.lastDeliveredDoc?.documentId === documentId) {
    fresh.lastDeliveredDoc = {
      ...fresh.lastDeliveredDoc,
      title,
      url,
    };
    saveMemory(fresh, { bumpInteraction: false });
  }

  let complianceBlock = "";
  if (isComplianceReviewAfterWriteEnabled()) {
    try {
      const review = await reviewDraftWithLlm(title, body);
      complianceBlock = [
        "",
        "---",
        "",
        "**合规与风险提示（自动协审，非法律意见）**",
        "",
        review,
      ].join("\n");
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error("[docx-revise] 合规协审失败:", m);
      complianceBlock = [
        "",
        "---",
        "",
        "（合规协审调用失败，请人工复核后再发布。）",
      ].join("\n");
    }
  }

  return [
    "已按你的指令改稿并**写回飞书云文档**（页面内正文已替换）。",
    `标题（供核对）：${title}`,
    `链接：${url}`,
    "",
    "若需再改语气或局部段落，可继续说明具体句子。",
    complianceBlock,
  ].join("\n");
}
