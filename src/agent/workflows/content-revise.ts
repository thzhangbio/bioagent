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
  replaceDocumentViaLarkCliOverwrite,
  stripMarkdownToPlainFallback,
} from "../../lark/lark-cli-docs-update.js";
import {
  extractDocxDocumentIdsFromText,
  hasAnyDocxInChatIndex,
  pickMostRecentDocumentIdFromIndex,
  refreshChatDocxIndexFromHistory,
} from "../../memory/chat-docx-index.js";
import {
  loadMemory,
  saveMemory,
  type MemoryStore,
} from "../../memory/store.js";

/** 改稿默认经 lark-cli `docs +update` 写回；模型须输出 Lark-flavored Markdown 正文 */
const DOCX_REVISE_SYSTEM = `你是医学新媒体编辑。用户要求**修改**一篇已存在的稿件正文（将通过 **飞书 Lark Markdown** 写回云文档）。

要求：
- **输出结构（必须严格遵守）**：
  - 第 1 行：**仅一行**——修改后的**发布标题**（纯文本一行，不要加 #）。
  - 第 2 行：必须为空行。
  - 第 3 行起：**正文**，使用 **飞书 Lark Markdown**：段落之间空一行；可用 \`##\` / \`###\` 表示小标题；可用 \`**粗体**\`；可用 \`>\` 引用；列表用 \`-\` 或 \`1.\`。
  - 正文内**不要**重复抄写第一行的标题；需要文首展示标题时，程序会在文档顶部自动插入一级标题。
- **以【当前文档正文】为事实基底**；**禁止编造**新数据、病例或文献结论；不确定处用审慎表述或删去。
- 医学表述审慎，遵守广告法。
- 不要开场白或后记说明；不要输出「已保存」等系统话术。`;

/** 从消息中提取飞书 docx 的 document_id（URL 路径 `/docx/<token>`） */
export function extractDocxDocumentIdFromText(raw: string): string | null {
  const ids = extractDocxDocumentIdsFromText(raw);
  return ids[0] ?? null;
}

/**
 * 解析改稿目标文档：**当前消息链接** → **本会话索引** → **memory 最近交付** → **拉会话历史并更新索引**。
 */
async function resolveDocumentIdForRevise(
  chatId: string,
  userText: string,
  memory: MemoryStore,
): Promise<{ documentId: string | null; sourceLabel: string }> {
  const fromUrl = extractDocxDocumentIdFromText(userText);
  if (fromUrl) {
    return { documentId: fromUrl, sourceLabel: "当前消息中的云文档链接" };
  }

  const fromIndex = pickMostRecentDocumentIdFromIndex(chatId);
  if (fromIndex) {
    return {
      documentId: fromIndex,
      sourceLabel: "本会话云文档链接索引（最近一条）",
    };
  }

  if (memory.lastDeliveredDoc?.documentId) {
    return {
      documentId: memory.lastDeliveredDoc.documentId,
      sourceLabel: "结构化记忆「最近交付」文档",
    };
  }

  if (process.env.FEISHU_CHAT_DOCX_REFRESH_HISTORY !== "0") {
    try {
      const pages = Number(process.env.FEISHU_CHAT_DOCX_HISTORY_PAGES ?? 8);
      const r = await refreshChatDocxIndexFromHistory(chatId, {
        maxPages: pages,
      });
      console.log(
        `[docx-revise] 会话历史已拉取：扫描消息 ${r.scannedMessages} 条，新增文档条目 ${r.newDocumentIds}`,
      );
      const after = pickMostRecentDocumentIdFromIndex(chatId);
      if (after) {
        return {
          documentId: after,
          sourceLabel: "会话历史消息（im.v1.message.list）解析后的索引",
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[docx-revise] 拉取会话历史失败:", msg);
    }
  }

  return { documentId: null, sourceLabel: "" };
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
    /改稿|改一下|改改|改成|改为|润色|删改|修改|调整|缩短|加长|优化|重写|修订|更新|精简|扩写|口语化|专业化|去AI味|更正式|更活泼|替换|删掉|加上|写回|同步到|校正|修复|规整|修一下|给修/u.test(
      t,
    );
  if (!hasReviseVerb) return false;

  const mentionsContext =
    /文档|云文档|飞书|docx|那篇|上一篇|刚写的|成稿|这篇|这段|那段|段落|交付稿|链接里|刚发|刚给你|文献|正文里|页面里|标题|小标题|格式|加粗|排版|样式|显示|对齐/u.test(
      t,
    ) || /docx\/[a-zA-Z0-9_-]+/u.test(userText);

  const formatRevise =
    /格式|加粗|小标题|标题层级|排版|样式|显示出来|显示不对|Markdown|markdown/u.test(t) &&
    /改|修|调|校正|弄|弄一下|优化|统一/u.test(t);

  const shortStandalone =
    t.length <= 48 &&
    /^(?:请|麻烦|帮我)?(?:润色|改一下|优化|修改|调整)(?:下|一下)?[。.!！？\s]*$/u.test(t);

  return mentionsContext || formatRevise || shortStandalone;
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
    /稿|正文|文档|那段|这段|段落|标题|导语|开头|结尾|句子|语气|版本|云文档|飞书|笔记|文章|文案|文献|格式|加粗|小标题|排版|样式/u.test(t);
  const strongRevise =
    /润色|缩短|加长|扩写|精简|口语化|专业化|去AI味|更正式|更活泼|改稿|重写|修订|删改/u.test(t);
  const weakVerb = /修改|调整|优化|替换|删掉|加上|更新/u.test(t) && docCue;
  return strongRevise || weakVerb;
}

/**
 * 会话里已有云文档上下文，但本条**不像改稿指令**（常见于用户分两条发：先贴标题、再发「修改一下」）。
 * 此时若走通用对话，模型易输出与后续改稿工作流矛盾的说明，故在路由层短路为简短确认，**不调用**基座对话。
 */
export function isLikelyDocTitleOrSnippetWithoutReviseTask(
  userText: string,
  normalized: string,
  chatId: string,
  memory: MemoryStore,
): boolean {
  const hasDocContext =
    hasAnyDocxInChatIndex(chatId) || !!memory.lastDeliveredDoc?.documentId;
  if (!hasDocContext) return false;

  const t = normalized.trim();
  const nonEmptyLines = userText
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (nonEmptyLines.length > 2) return false;
  if (t.length < 8 || t.length > 400) return false;

  if (isWriteTaskIntent(normalized)) return false;
  if (isDocxReviseIntent(normalized)) return false;
  if (
    shouldRunDocxReviseHeuristic(
      userText,
      !!memory.lastDeliveredDoc?.documentId || hasAnyDocxInChatIndex(chatId),
    )
  ) {
    return false;
  }

  if (
    /[？?]|吗\b|什么|怎么|如何|能否|可不可以|是否|请|帮我|麻烦|修改|改稿|润色|排版|格式|加粗|删除|补充|优化|调整|重写|缩短|加长|更新|替换|写回|同步/u.test(
      t,
    )
  ) {
    return false;
  }

  return true;
}

export interface DocxReviseWorkflowOptions {
  senderOpenId?: string;
}

/**
 * 读取最近一次交付或链接中的 docx → 检索 → Claude 改稿 → 写回页面正文。
 */
export async function runDocxReviseWorkflow(
  chatId: string,
  userText: string,
  workflowOpts: DocxReviseWorkflowOptions = {},
): Promise<string> {
  void workflowOpts;

  const memory = loadMemory();
  const resolved = await resolveDocumentIdForRevise(chatId, userText, memory);
  const documentId = resolved.documentId;

  if (!documentId) {
    return [
      "未找到可改稿的云文档。你可以：",
      "",
      "1. 本条消息附上 **飞书 docx 链接**（路径含 `/docx/文档ID`）；或",
      "2. 先在对话里发过带云文档链接的消息（我会写入**本会话索引**）；或",
      "3. 先完成一篇并交付到飞书（会登记「最近交付」）。",
      "",
      "若对话里曾有过链接但仍提示本条：可能是索引未写入或历史拉取失败（需机器人在会话内且具备拉取会话消息等权限）。",
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

  let writeBackMode: "lark_cli_md" | "lark_cli_fallback_sdk";
  const fullMarkdown = body.trim();
  try {
    const writeResult = await replaceDocumentViaLarkCliOverwrite(documentId, fullMarkdown, {
      newTitle: title.trim(),
    });
    writeBackMode = "lark_cli_md";
    console.log(
      `[docx-revise] 已通过 lark-cli docs +update（overwrite）写回 Markdown (identity=${writeResult.identity})`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[docx-revise] lark-cli 写回失败，回退为 Node SDK 纯文本:", msg);
    try {
      await replaceDocumentPagePlainText(
        documentId,
        stripMarkdownToPlainFallback(fullMarkdown),
      );
      writeBackMode = "lark_cli_fallback_sdk";
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[docx-revise] 回退写回仍失败:", msg2);
      return [
        "改稿内容已生成，但**未能写入飞书云文档**（lark-cli 与备用通道均失败）。",
        "",
        `lark-cli：${msg.slice(0, 200)}`,
        `SDK：${msg2.slice(0, 200)}`,
        "",
        "请确认本机已安装 `lark-cli` 且已登录（如 `lark-cli auth login`）；或检查开放平台 docx 权限与网络。",
      ].join("\n");
    }
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

  const locateLine =
    resolved.sourceLabel && resolved.sourceLabel !== "当前消息中的云文档链接" ?
      [`定位：${resolved.sourceLabel}。`]
    : [];

  const askedRich =
    /加粗|小标题|标题层级|标题样式|格式|排版|样式|Markdown|markdown/u.test(
      userText,
    );
  const plainNote =
    writeBackMode === "lark_cli_md" ?
      []
    : askedRich ?
      [
        "",
        "**说明**：`lark-cli` 写回未成功，已改用 **OpenAPI 纯文本**备用通道（标题/加粗等可能需在文档内再调）。请在本机安装并登录 `lark-cli`（如 `lark-cli auth login`）后重试改稿。",
      ]
    : writeBackMode === "lark_cli_fallback_sdk" ?
      [
        "",
        "**说明**：本次以纯文本写回；完整 Markdown 样式需 `lark-cli` 可用时生效。",
      ]
    : [];

  const writeHint =
    writeBackMode === "lark_cli_md" ?
      "（已通过 **lark-cli** 以 **Lark Markdown** 覆盖页面正文；含标题层级与粗体等，**overwrite** 会重建正文区，复杂嵌入块请见 lark-doc 最佳实践。）"
    : "（页面内正文已用**纯文本**替换：`lark-cli` 未成功。）";

  return [
    `已按你的指令改稿并**写回飞书云文档** ${writeHint}`,
    ...locateLine,
    `标题（供核对）：${title}`,
    `链接：${url}`,
    "",
    "若需再改语气或局部段落，可继续说明具体句子。",
    ...plainNote,
  ].join("\n");
}
