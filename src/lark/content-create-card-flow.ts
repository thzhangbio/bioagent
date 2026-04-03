import { runContentCreateWorkflow } from "../agent/workflows/content-create.js";
import { generateDynamicCardFields } from "../agent/workflows/content-create-card-llm.js";
import {
  buildContentCreateConsentCard,
  buildContentCreateInteractiveCard,
} from "./content-create-card-builder.js";
import {
  createContentCreateCardSession,
  deleteContentCreateCardSession,
  getContentCreateCardSession,
  type ContentCreateCardSession,
} from "./content-create-card-session.js";
import {
  createContentCreateConsentSession,
  deleteContentCreateConsentSession,
  getContentCreateConsentSession,
  type ContentCreateConsentSession,
} from "./content-create-consent-session.js";
import { formValuesToWriterBrief } from "./content-create-card-form-map.js";
import { sendInteractiveCard, sendMessage } from "./messages.js";
import {
  setWriteMergeGate,
  syncWriteMergeGateFromWorkflowReply,
} from "../agent/write-merge-gate.js";
import {
  appendConversationMessages,
  handleUserMessage,
  popLastConversationMessages,
} from "../agent/router.js";

interface ParsedCardValue {
  action?: string;
  session_id?: string;
  consent_id?: string;
  choice?: string;
}

function parseCardActionValue(value: unknown): ParsedCardValue {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as ParsedCardValue;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ParsedCardValue;
    } catch {
      return {};
    }
  }
  return {};
}

/** 从按钮 action 上取回传 value（兼容 behaviors[].callback） */
function extractCallbackValue(action: Record<string, unknown>): unknown {
  const direct = action.value;
  if (direct != null) return direct;
  const behaviors = action.behaviors;
  if (!Array.isArray(behaviors)) return undefined;
  for (const b of behaviors) {
    if (
      b &&
      typeof b === "object" &&
      (b as { type?: string }).type === "callback"
    ) {
      return (b as { value?: unknown }).value;
    }
  }
  return undefined;
}

const FORM_CARD_ACK =
  "已为你展开**撰稿参数卡片**（见上方消息）。请勾选选项后点击 **「细节已明，开始生成」**；也可用文字继续补充说明。";

/**
 * 创作意图首屏：先发 Yes/No 确认卡片，不直接进入参数表单。
 */
export async function sendContentCreateConsentCard(params: {
  chatId?: string;
  userId?: string;
  senderOpenId: string;
  userText: string;
}): Promise<void> {
  const session = createContentCreateConsentSession({
    chatId: params.chatId,
    userId: params.userId,
    senderOpenId: params.senderOpenId,
    originalRequest: params.userText,
  });
  const card = buildContentCreateConsentCard({
    consentId: session.consentId,
    workflowName: "内容创作",
  });
  if (params.chatId) {
    await sendInteractiveCard({ chatId: params.chatId, card });
  } else if (params.userId) {
    await sendInteractiveCard({ userId: params.userId, card });
  }
}

/**
 * 用户首句触发写作意图且已选 Yes：生成动态题、下发交互卡片。
 */
export async function sendContentCreateFormCard(params: {
  chatId?: string;
  userId?: string;
  senderOpenId: string;
  userText: string;
}): Promise<void> {
  const dynamicFields = await generateDynamicCardFields(params.userText);
  const session = createContentCreateCardSession({
    chatId: params.chatId,
    userId: params.userId,
    senderOpenId: params.senderOpenId,
    originalRequest: params.userText,
    dynamicFields,
  });
  const card = buildContentCreateInteractiveCard({
    sessionId: session.sessionId,
    originalRequestPreview: params.userText,
    dynamicFields,
  });
  if (params.chatId) {
    await sendInteractiveCard({ chatId: params.chatId, card });
  } else if (params.userId) {
    await sendInteractiveCard({ userId: params.userId, card });
  }
}

async function runCardSubmitWorkflow(
  session: ContentCreateCardSession,
  formValue: Record<string, string>,
): Promise<void> {
  const structured = formValuesToWriterBrief(session, formValue);
  const combined = [
    session.originalRequest.trim(),
    "",
    "---",
    "",
    structured,
  ].join("\n");

  let reply: string;
  try {
    const chatKey = session.chatId ?? session.senderOpenId;
    reply = await runContentCreateWorkflow(chatKey, combined, {
      senderOpenId: session.senderOpenId,
      skipAlignmentGates: true,
    });
    syncWriteMergeGateFromWorkflowReply(chatKey, reply);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[card] 成稿失败:", msg);
    reply = `成稿失败：${msg.slice(0, 300)}`;
  }

  deleteContentCreateCardSession(session.sessionId);

  if (session.chatId) {
    await sendMessage({ chatId: session.chatId, markdown: reply });
  } else {
    await sendMessage({ userId: session.senderOpenId, markdown: reply });
  }
}

async function runConsentYesAsync(session: ContentCreateConsentSession): Promise<void> {
  const chatKey = session.chatId ?? session.senderOpenId;
  popLastConversationMessages(chatKey, 2);
  appendConversationMessages(chatKey, session.originalRequest, FORM_CARD_ACK);
  await sendContentCreateFormCard({
    chatId: session.chatId,
    userId: session.userId,
    senderOpenId: session.senderOpenId,
    userText: session.originalRequest,
  });
  if (session.chatId) {
    await sendMessage({ chatId: session.chatId, markdown: FORM_CARD_ACK });
  } else {
    await sendMessage({ userId: session.senderOpenId, markdown: FORM_CARD_ACK });
  }
  setWriteMergeGate(chatKey, "awaiting_supplement");
}

async function runConsentNoAsync(session: ContentCreateConsentSession): Promise<void> {
  const chatKey = session.chatId ?? session.senderOpenId;
  popLastConversationMessages(chatKey, 2);
  setWriteMergeGate(chatKey, "closed");
  try {
    const reply = await handleUserMessage(chatKey, session.originalRequest, {
      senderOpenId: session.senderOpenId,
      forceGeneralChat: true,
    });
    if (session.chatId) {
      await sendMessage({ chatId: session.chatId, markdown: reply });
    } else {
      await sendMessage({ userId: session.senderOpenId, markdown: reply });
    }
  } catch (e) {
    console.error("[card] consent No 后日常对话失败:", e);
    const fallback =
      "好的，我们按日常对话继续。你可以直接说明需求，或换一种方式描述撰稿想法。";
    if (session.chatId) {
      await sendMessage({ chatId: session.chatId, markdown: fallback });
    } else {
      await sendMessage({ userId: session.senderOpenId, markdown: fallback });
    }
  }
}

/**
 * 解析飞书 `card.action.trigger`（含 schema 2.0）：确认 Yes/No、表单提交。
 * 必须在 **数秒内** 返回合法响应体（含 toast），重活放异步执行，避免长连接超时。
 */
export async function handleContentCreateCardEvent(
  raw: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (process.env.DEBUG_LARK === "1") {
    console.log("[card] card.action.trigger keys:", Object.keys(raw));
  }

  const event = (raw.event ?? raw) as Record<string, unknown>;
  const action = (event.action ?? event.card_action ?? raw.action) as
    | Record<string, unknown>
    | undefined;
  if (!action) {
    console.warn("[card] 无 action 字段");
    return {
      toast: { type: "error", content: "无法解析卡片操作，请重试。" },
    };
  }

  const rawValue = extractCallbackValue(action);
  const valueParsed = parseCardActionValue(rawValue);

  if (process.env.DEBUG_LARK === "1") {
    console.log("[card] parsed value:", JSON.stringify(valueParsed));
  }

  if (valueParsed.action === "content_create_consent") {
    const consentId = valueParsed.consent_id;
    const choice = valueParsed.choice;
    if (!consentId || (choice !== "yes" && choice !== "no")) {
      return {
        toast: { type: "error", content: "无法解析确认操作，请重试。" },
      };
    }
    const session = getContentCreateConsentSession(consentId);
    if (!session) {
      return {
        toast: { type: "error", content: "确认已过期，请重新发起写作任务。" },
      };
    }
    deleteContentCreateConsentSession(consentId);

    if (choice === "yes") {
      void runConsentYesAsync(session).catch((e) => {
        console.error("[card] consent Yes 异步流程失败:", e);
      });
      return {
        toast: { type: "success", content: "正在展开撰稿参数卡片…" },
      };
    }

    void runConsentNoAsync(session).catch((e) => {
      console.error("[card] consent No 异步流程失败:", e);
    });
    return {
      toast: { type: "info", content: "已切换为日常对话，请稍候查看下一条消息。" },
    };
  }

  if (valueParsed.action !== "content_create_submit" || !valueParsed.session_id) {
    return {};
  }

  const session = getContentCreateCardSession(valueParsed.session_id);
  if (!session) {
    console.warn("[card] session 已过期或不存在:", valueParsed.session_id);
    return {
      toast: { type: "error", content: "会话已过期，请重新发起写作任务。" },
    };
  }

  const formValue = (action.form_value ??
    action.formValue ??
    event.form_value ??
    {}) as Record<string, string>;

  if (process.env.DEBUG_LARK === "1") {
    console.log("[card] form_value:", JSON.stringify(formValue));
  }

  void runCardSubmitWorkflow(session, formValue).catch((e) => {
    console.error("[card] 异步成稿未捕获错误:", e);
  });

  return {
    toast: {
      type: "success",
      content: "已收到参数，正在生成稿件，请稍候查看下一条消息。",
    },
  };
}
