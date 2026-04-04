import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic.js";
import { augmentUserTextWithRag } from "./rag-context.js";
import {
  buildMergedWriteRequest,
  extractLastWriteTaskInstruction,
  isPlausibleWriteMergeFollowUp,
  isRepeatWriteShortcut,
  isWriteTaskIntent,
  normalizeUserTextForIntent,
  runContentCreateWorkflow,
  type ContentCreateWorkflowOptions,
} from "./workflows/content-create.js";
import {
  isDocxReviseIntent,
  runDocxReviseWorkflow,
  shouldRunDocxReviseHeuristic,
} from "./workflows/content-revise.js";
import {
  getWriteMergeGate,
  syncWriteMergeGateFromWorkflowReply,
} from "./write-merge-gate.js";
import { buildSystemPrompt } from "../prompts/medical-editor.js";
import { formatForPrivacyLog, isDebugContentLogEnabled } from "../lib/privacy-log.js";
import {
  compactChatSessionIfNeeded,
  getChatSession,
  persistChatSession,
  saveChatSessionFile,
} from "../memory/chat-session.js";
import { formatStructuredMemoryBlock } from "../memory/structured-context.js";
import { loadMemory, saveMemory, type CompanyProfile } from "../memory/store.js";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function getHistory(chatId: string): ConversationMessage[] {
  return getChatSession(chatId).messages;
}

/** 飞书卡片模式下仅记录一轮对话（不跑成稿路由） */
export function appendConversationMessages(
  chatId: string,
  user: string,
  assistant: string,
): void {
  const s = getChatSession(chatId);
  s.messages.push({ role: "user", content: user });
  s.messages.push({ role: "assistant", content: assistant });
  saveChatSessionFile(chatId, s);
  void persistChatSession(chatId);
}

/** 从会话末尾移除若干条消息（用于卡片确认后回滚「用户句 + 机器人 ack」再重走路由） */
export function popLastConversationMessages(chatId: string, count: number): void {
  const s = getChatSession(chatId);
  const n = Math.min(Math.max(0, count), s.messages.length);
  if (n === 0) return;
  s.messages.splice(s.messages.length - n, n);
  saveChatSessionFile(chatId, s);
}

export async function handleUserMessage(
  chatId: string,
  userText: string,
  meta?: Pick<ContentCreateWorkflowOptions, "senderOpenId"> & {
    /** 为 true 时跳过内容创作工作流（含合并成稿），按日常对话处理 */
    forceGeneralChat?: boolean;
  },
): Promise<string> {
  try {
    const history = getHistory(chatId);
    const memory = loadMemory();
    const normalized = normalizeUserTextForIntent(userText);
    const createIntent =
      meta?.forceGeneralChat === true ? false : isWriteTaskIntent(normalized);
    console.log(
      `[router] content-create intent=${createIntent} ${formatForPrivacyLog(normalized, "text")}`,
    );

    if (createIntent) {
      history.push({ role: "user", content: userText });
      try {
        const reply = await runContentCreateWorkflow(chatId, normalized, {
          senderOpenId: meta?.senderOpenId,
        });
        syncWriteMergeGateFromWorkflowReply(chatId, reply);
        history.push({ role: "assistant", content: reply });
        extractAndSaveInfo(userText, memory);
        return reply;
      } catch (err) {
        history.pop();
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[agent] content-create 工作流失败:", msg);
        return "抱歉，内容创作流程暂时失败，请稍后再试。";
      }
    }

    if (!meta?.forceGeneralChat && isRepeatWriteShortcut(normalized)) {
      const priorInstruction = extractLastWriteTaskInstruction(history);
      if (!priorInstruction) {
        return "没有找到上一篇创作指令。请先发送一条完整的写作需求（例如仿梅斯文献→微信公众号的完整句式），再说「再写一篇」。";
      }
      const repeatedPayload = normalizeUserTextForIntent(priorInstruction);
      history.push({ role: "user", content: userText });
      try {
        console.log(
          `[router] 再写一篇：复用上一指令 length=${repeatedPayload.length}`,
        );
        const reply = await runContentCreateWorkflow(chatId, repeatedPayload, {
          senderOpenId: meta?.senderOpenId,
        });
        syncWriteMergeGateFromWorkflowReply(chatId, reply);
        history.push({ role: "assistant", content: reply });
        extractAndSaveInfo(userText, memory);
        return reply;
      } catch (err) {
        history.pop();
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[agent] 再写一篇 工作流失败:", msg);
        return "抱歉，内容创作流程暂时失败，请稍后再试。";
      }
    }

    const mergedWrite = buildMergedWriteRequest(history, userText);
    if (
      mergedWrite &&
      getWriteMergeGate(chatId) === "awaiting_supplement" &&
      isPlausibleWriteMergeFollowUp(userText)
    ) {
      console.log(
        `[router] content-create 合并追问上下文，gate=awaiting_supplement，走 docx 工作流`,
      );
      history.push({ role: "user", content: userText });
      try {
        const reply = await runContentCreateWorkflow(chatId, mergedWrite, {
          senderOpenId: meta?.senderOpenId,
        });
        syncWriteMergeGateFromWorkflowReply(chatId, reply);
        history.push({ role: "assistant", content: reply });
        extractAndSaveInfo(userText, memory);
        return reply;
      } catch (err) {
        history.pop();
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[agent] content-create（合并）失败:", msg);
        return "抱歉，内容创作流程暂时失败，请稍后再试。";
      }
    }

    const wantsDocxRevise =
      isDocxReviseIntent(normalized) ||
      shouldRunDocxReviseHeuristic(userText, !!memory.lastDeliveredDoc?.documentId);
    if (!meta?.forceGeneralChat && wantsDocxRevise) {
      history.push({ role: "user", content: userText });
      try {
        const reply = await runDocxReviseWorkflow(chatId, normalized, {
          senderOpenId: meta?.senderOpenId,
        });
        history.push({ role: "assistant", content: reply });
        extractAndSaveInfo(userText, memory);
        return reply;
      } catch (err) {
        history.pop();
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[agent] 飞书 docx 改稿工作流失败:", msg);
        return "抱歉，改稿流程暂时失败，请稍后再试。";
      }
    }

    const effectiveUser = await augmentUserTextWithRag(userText);
    history.push({ role: "user", content: effectiveUser });

    await compactChatSessionIfNeeded(getChatSession(chatId));

    const session = getChatSession(chatId);
    const companyBlock =
      memory.companyProfile ?
        formatProfile(memory.companyProfile)
      : "尚未了解。如果是首次对话，请主动询问公司基本信息（公司名称、主营产品/服务、目标客户群体、品牌调性）。";
    const systemPrompt = buildSystemPrompt({
      companyProfileBlock: companyBlock,
      structuredMemoryBlock: formatStructuredMemoryBlock(memory),
      conversationSummaryBlock: session.summary.trim() ?
        session.summary
      : "（暂无；下方为最近轮次对话全文。）",
    });

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

    try {
      const response = await getAnthropicClient().messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantText =
        response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n") || "（无内容）";

      history.push({ role: "assistant", content: assistantText });

      extractAndSaveInfo(userText, memory);

      return assistantText;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[agent] Claude API 调用失败:", msg);

      history.pop();

      if (msg.includes("401") || msg.includes("auth")) {
        return "抱歉，我的身份凭证出了问题，请联系管理员检查 ANTHROPIC_API_KEY 配置。";
      }
      return "抱歉，我暂时处理不了这个请求，请稍后再试。";
    }
  } finally {
    await persistChatSession(chatId);
  }
}

function formatProfile(p: CompanyProfile): string {
  const lines: string[] = [];
  if (p.name) lines.push(`- 公司名称：${p.name}`);
  if (p.products) lines.push(`- 主营产品/服务：${p.products}`);
  if (p.targetCustomers) lines.push(`- 目标客户：${p.targetCustomers}`);
  if (p.brandTone) lines.push(`- 品牌调性：${p.brandTone}`);
  if (p.competitors) lines.push(`- 竞品：${p.competitors}`);
  if (p.notes) lines.push(`- 补充信息：${p.notes}`);
  return lines.length > 0 ? lines.join("\n") : "已开始收集，信息暂不完整。";
}

function extractAndSaveInfo(
  userText: string,
  memory: ReturnType<typeof loadMemory>,
): void {
  if (
    /你是小编|我说了原则|补充.{0,8}一轮又一轮|不要选了|元对话|吐槽机器人/i.test(
      userText,
    )
  ) {
    return;
  }

  const profile = memory.companyProfile || ({} as CompanyProfile);
  let changed = false;

  const patterns: Array<{
    regex: RegExp;
    field: keyof CompanyProfile;
  }> = [
    { regex: /(?:我们?(?:公司)?(?:叫|是|名[叫称为]?)|公司名?[叫是称为])[\s:：]*(.{2,30})/, field: "name" },
    { regex: /(?:(?:主要|主营|核心)?(?:做|卖|经营|产品|服务)[的是]?)[\s:：]*(.{2,50})/, field: "products" },
    { regex: /(?:目标|针对|面向|客户|用户|人群)[的是]?[\s:：]*(.{2,50})/, field: "targetCustomers" },
    { regex: /(?:调性|风格|品牌|定位)[的是]?[\s:：]*(.{2,50})/, field: "brandTone" },
    { regex: /(?:竞品|竞争对手|同行)[的是有]?[\s:：]*(.{2,50})/, field: "competitors" },
  ];

  for (const { regex, field } of patterns) {
    if (!profile[field]) {
      const match = userText.match(regex);
      if (match?.[1]) {
        (profile as Record<string, string>)[field] = match[1].trim();
        changed = true;
      }
    }
  }

  const prefMatch = userText.match(
    /(?:写作偏好|协作偏好|内容偏好)[：:]\s*(.+)/u,
  );
  if (prefMatch) {
    const line = prefMatch[1]!.trim().slice(0, 200);
    if (line.length >= 2) {
      const arr = [...(memory.contentPreferences ?? [])];
      if (arr.length < 10 && !arr.includes(line)) {
        arr.push(line);
        memory.contentPreferences = arr;
        changed = true;
      }
    }
  }

  if (changed) {
    memory.companyProfile = profile;
    saveMemory(memory);
    const payload = JSON.stringify({
      profile: memory.companyProfile,
      contentPreferences: memory.contentPreferences,
    });
    console.log(
      "[agent] 结构化记忆已更新:",
      isDebugContentLogEnabled() ?
        payload
      : formatForPrivacyLog(payload, "companyProfile"),
    );
  }
}
