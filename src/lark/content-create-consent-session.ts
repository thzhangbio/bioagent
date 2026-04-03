import { randomUUID } from "node:crypto";

export interface ContentCreateConsentSession {
  consentId: string;
  chatId?: string;
  userId?: string;
  senderOpenId: string;
  /** 用户触发创作意图时的原文 */
  originalRequest: string;
  createdAt: number;
}

const sessions = new Map<string, ContentCreateConsentSession>();
const TTL_MS = 60 * 60 * 1000;

export function createContentCreateConsentSession(
  params: Omit<ContentCreateConsentSession, "consentId" | "createdAt">,
): ContentCreateConsentSession {
  if (!params.chatId && !params.userId) {
    throw new Error("createContentCreateConsentSession: 需要 chatId 或 userId");
  }
  pruneExpired();
  const session: ContentCreateConsentSession = {
    ...params,
    consentId: randomUUID(),
    createdAt: Date.now(),
  };
  sessions.set(session.consentId, session);
  return session;
}

export function getContentCreateConsentSession(
  consentId: string,
): ContentCreateConsentSession | undefined {
  pruneExpired();
  return sessions.get(consentId);
}

export function deleteContentCreateConsentSession(consentId: string): void {
  sessions.delete(consentId);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (now - v.createdAt > TTL_MS) sessions.delete(k);
  }
}
