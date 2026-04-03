import { randomUUID } from "node:crypto";

import type { DynamicCardField } from "../agent/workflows/content-create-card-llm.js";

export interface ContentCreateCardSession {
  sessionId: string;
  /** 群或私聊会话 id；与 userId 至少其一有值 */
  chatId?: string;
  /** 私聊收消息用 open_id（无 chat_id 时发卡片/回稿） */
  userId?: string;
  senderOpenId: string;
  /** 用户触发卡片时的原始请求句 */
  originalRequest: string;
  dynamicFields: DynamicCardField[];
  createdAt: number;
}

const sessions = new Map<string, ContentCreateCardSession>();
const TTL_MS = 60 * 60 * 1000;

export function createContentCreateCardSession(
  params: Omit<ContentCreateCardSession, "sessionId" | "createdAt">,
): ContentCreateCardSession {
  if (!params.chatId && !params.userId) {
    throw new Error("createContentCreateCardSession: 需要 chatId 或 userId");
  }
  pruneExpired();
  const session: ContentCreateCardSession = {
    ...params,
    sessionId: randomUUID(),
    createdAt: Date.now(),
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function getContentCreateCardSession(
  sessionId: string,
): ContentCreateCardSession | undefined {
  pruneExpired();
  return sessions.get(sessionId);
}

export function deleteContentCreateCardSession(sessionId: string): void {
  sessions.delete(sessionId);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TTL_MS) sessions.delete(k);
  }
}
