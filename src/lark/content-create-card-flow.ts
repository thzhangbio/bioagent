import { runContentCreateWorkflow } from "../agent/workflows/content-create.js";
import { generateDynamicCardFields } from "../agent/workflows/content-create-card-llm.js";
import { buildContentCreateInteractiveCard } from "./content-create-card-builder.js";
import {
  createContentCreateCardSession,
  deleteContentCreateCardSession,
  getContentCreateCardSession,
  type ContentCreateCardSession,
} from "./content-create-card-session.js";
import { formValuesToWriterBrief } from "./content-create-card-form-map.js";
import { sendInteractiveCard, sendMessage } from "./messages.js";
import { syncWriteMergeGateFromWorkflowReply } from "../agent/write-merge-gate.js";

function parseButtonValue(
  value: unknown,
): { action?: string; session_id?: string } {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as { action?: string; session_id?: string };
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as { action?: string; session_id?: string };
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * 用户首句触发写作意图后：生成动态题、下发交互卡片。
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

/**
 * 解析飞书 `card.action.trigger`（含 schema 2.0），处理「开始生成」。
 * 必须在 **数秒内** 返回合法响应体（含 toast），成稿放异步执行，避免长连接超时。
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

  const valueParsed = parseButtonValue(action.value);
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
