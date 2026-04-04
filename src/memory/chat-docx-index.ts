import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getFeishuClient } from "../lark/feishu-client.js";

/** 与 `chat-session` 一致的 chatId 文件名安全化 */
function sanitizeChatIdForPath(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

const INDEX_DIR = join(process.cwd(), "data", "chat-docx-index");

export interface DocxIndexEntry {
  documentId: string;
  url: string;
  firstSeenAt: string;
  lastSeenAt: string;
  /** 首次出现来源 */
  source?: "user" | "assistant" | "history";
}

export interface ChatDocxIndexFile {
  version: 1;
  entries: DocxIndexEntry[];
}

function indexPath(chatId: string): string {
  return join(INDEX_DIR, `${sanitizeChatIdForPath(chatId)}.json`);
}

function buildDocxWebUrl(documentId: string): string {
  const base =
    process.env.FEISHU_WEB_BASE?.replace(/\/$/, "") ?? "https://feishu.cn";
  return `${base}/docx/${documentId}`;
}

/** 从任意文本中抽取新版云文档 document_id（可多条） */
export function extractDocxDocumentIdsFromText(raw: string): string[] {
  const ids = new Set<string>();
  const re = /\/docx\/([a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    ids.add(m[1]!);
  }
  return [...ids];
}

export function loadChatDocxIndex(chatId: string): ChatDocxIndexFile {
  const p = indexPath(chatId);
  if (!existsSync(p)) {
    return { version: 1, entries: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Partial<ChatDocxIndexFile>;
    if (raw?.version === 1 && Array.isArray(raw.entries)) {
      return { version: 1, entries: raw.entries as DocxIndexEntry[] };
    }
  } catch (e) {
    console.warn("[chat-docx-index] 读取失败:", e);
  }
  return { version: 1, entries: [] };
}

function saveChatDocxIndex(chatId: string, data: ChatDocxIndexFile): void {
  try {
    if (!existsSync(INDEX_DIR)) {
      mkdirSync(INDEX_DIR, { recursive: true });
    }
    writeFileSync(indexPath(chatId), JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[chat-docx-index] 保存失败:", e);
  }
}

/**
 * 从用户/助手消息正文中发现 docx 链接即写入本会话索引（按 documentId 去重，更新 lastSeenAt）。
 */
export function recordDocxLinksFromText(
  chatId: string,
  rawText: string,
  source: "user" | "assistant",
): void {
  const ids = extractDocxDocumentIdsFromText(rawText);
  if (ids.length === 0) return;
  const data = loadChatDocxIndex(chatId);
  const now = new Date().toISOString();
  for (const id of ids) {
    const url = buildDocxWebUrl(id);
    const existing = data.entries.find((e) => e.documentId === id);
    if (existing) {
      existing.lastSeenAt = now;
      existing.url = url;
    } else {
      data.entries.push({
        documentId: id,
        url,
        firstSeenAt: now,
        lastSeenAt: now,
        source,
      });
    }
  }
  saveChatDocxIndex(chatId, data);
}

function mergeHistoryDocIds(chatId: string, documentIds: string[]): void {
  if (documentIds.length === 0) return;
  const data = loadChatDocxIndex(chatId);
  const now = new Date().toISOString();
  for (const id of documentIds) {
    const url = buildDocxWebUrl(id);
    const existing = data.entries.find((e) => e.documentId === id);
    if (existing) {
      existing.lastSeenAt = now;
      existing.url = url;
    } else {
      data.entries.push({
        documentId: id,
        url,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "history",
      });
    }
  }
  saveChatDocxIndex(chatId, data);
}

function extractPlainFromMessageBody(content: string | undefined): string {
  if (!content?.trim()) return "";
  const s = content.trim();
  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s) as { text?: string };
      if (typeof j.text === "string") return j.text;
    } catch {
      /* 非 JSON */
    }
  }
  return s;
}

function assertOk(res: { code?: number; msg?: string }, action: string): void {
  if (res.code !== undefined && res.code !== 0) {
    throw new Error(`${action} 失败: ${res.msg ?? "unknown"} (code=${res.code})`);
  }
}

/**
 * 调用 **`im.v1.message.list`** 分页拉取会话消息，从正文/富文本中解析 docx 链接并合并进索引。
 * 需机器人已在会话内；群聊另需「获取群组中所有消息」等权限（以开放平台为准）。
 */
export async function refreshChatDocxIndexFromHistory(
  chatId: string,
  options: { maxPages?: number } = {},
): Promise<{ scannedMessages: number; newDocumentIds: number }> {
  const maxPages = Math.max(1, Math.min(20, options.maxPages ?? 8));
  const before = loadChatDocxIndex(chatId);
  const beforeIds = new Set(before.entries.map((e) => e.documentId));

  const client = getFeishuClient();
  let pageToken: string | undefined;
  let scanned = 0;
  const allFound = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const res = await client.im.v1.message.list({
      params: {
        container_id_type: "chat",
        container_id: chatId,
        page_size: 50,
        sort_type: "ByCreateTimeDesc",
        ...(pageToken ? { page_token: pageToken } : {}),
      },
    });
    assertOk(res, "im.v1.message.list");
    const items = res.data?.items ?? [];
    if (items.length === 0) break;

    for (const it of items) {
      scanned++;
      const raw = it.body?.content ?? "";
      const plain = extractPlainFromMessageBody(raw);
      const blob = `${raw}\n${plain}`;
      for (const id of extractDocxDocumentIdsFromText(blob)) {
        allFound.add(id);
      }
    }

    const data = res.data;
    if (!data?.has_more) break;
    pageToken = data.page_token ?? (data as { next_page_token?: string }).next_page_token;
    if (!pageToken) break;
  }

  mergeHistoryDocIds(chatId, [...allFound]);

  const after = loadChatDocxIndex(chatId);
  let newCount = 0;
  for (const e of after.entries) {
    if (!beforeIds.has(e.documentId)) newCount++;
  }

  return { scannedMessages: scanned, newDocumentIds: newCount };
}

/** 本会话索引中是否已有至少一条 docx（用于放宽「润色一下」等短句路由） */
export function hasAnyDocxInChatIndex(chatId: string): boolean {
  return loadChatDocxIndex(chatId).entries.length > 0;
}

/** 按 lastSeenAt 取最近一条 docx（用于改稿缺省目标） */
export function pickMostRecentDocumentIdFromIndex(chatId: string): string | null {
  const data = loadChatDocxIndex(chatId);
  if (data.entries.length === 0) return null;
  const sorted = [...data.entries].sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
  return sorted[0]!.documentId;
}
