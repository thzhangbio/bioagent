import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "../agent/anthropic.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSessionFile {
  version: 1;
  /** 窗口之前轮次的压缩摘要 */
  summary: string;
  /** 滑动窗口内消息（含 user 侧 RAG 包裹后的内容） */
  messages: ChatTurn[];
}

const SESSION_DIR = join(process.cwd(), "data", "chat-sessions");

const cache = new Map<string, ChatSessionFile>();

function sessionPath(chatId: string): string {
  return join(SESSION_DIR, `${sanitizeChatId(chatId)}.json`);
}

function sanitizeChatId(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export function loadChatSessionFile(chatId: string): ChatSessionFile {
  const p = sessionPath(chatId);
  if (!existsSync(p)) {
    return { version: 1, summary: "", messages: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Partial<ChatSessionFile>;
    if (raw?.version === 1 && Array.isArray(raw.messages)) {
      const messages = raw.messages.filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      );
      return {
        version: 1,
        summary: typeof raw.summary === "string" ? raw.summary : "",
        messages,
      };
    }
  } catch (e) {
    console.warn("[chat-session] 读取失败:", e);
  }
  return { version: 1, summary: "", messages: [] };
}

export function saveChatSessionFile(chatId: string, data: ChatSessionFile): void {
  try {
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
    writeFileSync(sessionPath(chatId), JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[chat-session] 保存失败:", e);
  }
}

/** 取会话状态（可变；与磁盘同步前需调用 `persistChatSession`） */
export function getChatSession(chatId: string): ChatSessionFile {
  if (!cache.has(chatId)) {
    cache.set(chatId, loadChatSessionFile(chatId));
  }
  return cache.get(chatId)!;
}

/** 合并摘要后落盘（在回合结束时调用） */
export async function persistChatSession(chatId: string): Promise<void> {
  const session = getChatSession(chatId);
  await compactChatSessionIfNeeded(session);
  saveChatSessionFile(chatId, session);
}

const SUMMARY_SYSTEM = `你是对话秘书。将【旧摘要】与【待合并的新对话片段】整理为一段新的中文摘要。
要求：
- 总长度控制在 800 字以内。
- 保留：任务类型（写作/改稿/合规/闲聊）、已确认的事实与约束、未决问题。
- 省略：寒暄、重复套话、与职责无关的碎聊。
- 不要以「摘要」为标题，直接输出正文。`;

async function mergeSummaryWithChunk(
  previousSummary: string,
  chunk: ChatTurn[],
): Promise<string> {
  const fragment = chunk
    .map((m) =>
      m.role === "user" ? `用户：${m.content}` : `助手：${m.content}`,
    )
    .join("\n\n");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const maxOut = 1200;
  try {
    const res = await getAnthropicClient().messages.create({
      model,
      max_tokens: maxOut,
      system: SUMMARY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `【旧摘要】\n${previousSummary.trim() || "（无）"}\n\n【待合并的新对话片段】\n${fragment}`,
        },
      ],
    });
    const text =
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim() || previousSummary;
    const cap = Number(process.env.CHAT_SUMMARY_MAX_CHARS ?? 2500);
    return text.slice(0, cap);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[chat-session] 摘要合并失败，降级拼接:", msg);
    const fallback = `${previousSummary}\n\n---\n\n${fragment}`;
    return fallback.slice(-Number(process.env.CHAT_SUMMARY_MAX_CHARS ?? 2500));
  }
}

export function getMaxWindowMessages(): number {
  return Math.max(4, Number(process.env.CHAT_WINDOW_MAX_MESSAGES ?? 24));
}

/**
 * 超过轮数或总字符时，将最旧的一批消息并入摘要后从窗口删除。
 */
export async function compactChatSessionIfNeeded(
  session: ChatSessionFile,
): Promise<void> {
  const maxMsgs = getMaxWindowMessages();
  const maxChars = Number(process.env.CHAT_WINDOW_TOTAL_CHARS ?? 48_000);

  function totalChars(): number {
    return session.messages.reduce((s, m) => s + m.content.length, 0);
  }

  while (session.messages.length > maxMsgs || totalChars() > maxChars) {
    if (session.messages.length < 2) {
      console.warn(
        "[chat-session] 无法继续压缩窗口（消息过少或单条过长），请缩短单条输入。",
      );
      break;
    }

    const overByCount = session.messages.length - maxMsgs;
    let take: number;
    if (overByCount > 0) {
      take = Math.min(8, overByCount + (overByCount % 2));
      take = Math.max(2, take);
    } else {
      take = Math.min(8, session.messages.length);
    }
    take = Math.min(take, session.messages.length);
    if (take % 2 === 1) take -= 1;
    if (take < 2) break;

    const chunk = session.messages.splice(0, take);
    session.summary = await mergeSummaryWithChunk(session.summary, chunk);
  }
}
