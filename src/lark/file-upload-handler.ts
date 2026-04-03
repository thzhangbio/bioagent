import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { createEmbeddingClient } from "../knowledge/embeddings.js";
import { extractPlainTextFromFile, UnsupportedExtractError } from "../knowledge/extract-text.js";
import { ingestPersonalPlainText } from "../knowledge/personal-ingest.js";
import { PROJECT_ROOT } from "../knowledge/paths.js";
import type { LarkMessageEvent } from "./events.js";
import { downloadMessageFileResource } from "./message-resource.js";

const UPLOAD_DIR = join(PROJECT_ROOT, "data", "uploads");

function safeBasename(name: string): string {
  return name.replace(/[/\\?*:|"<>]/g, "_").slice(0, 120) || "file";
}

/**
 * 处理私聊/群内用户发送的文件消息：下载 → 抽取文本 → 写入 `personal` 向量集合。
 * 返回发给用户的说明文案（不含模型生成）。
 */
export async function handleUserFileMessage(
  event: LarkMessageEvent,
): Promise<string> {
  const att = event.attachment;
  if (!att) {
    return "未识别到附件信息，请重试或联系管理员。";
  }

  if (!process.env.OPENAI_API_KEY) {
    return "未配置 OPENAI_API_KEY，无法写入向量库。请在 .env 中配置 Embedding 密钥后重试。";
  }

  mkdirSync(UPLOAD_DIR, { recursive: true });
  const localName = `${event.messageId}_${safeBasename(att.fileName)}`;
  const destPath = join(UPLOAD_DIR, localName);

  try {
    await downloadMessageFileResource(event.messageId, att.fileKey, destPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[file-upload] 下载失败:", msg);
    return `文件下载失败（请确认应用权限含「获取消息中的资源文件」等 IM 能力）：${msg.slice(0, 200)}`;
  }

  let text: string;
  try {
    text = extractPlainTextFromFile(destPath);
  } catch (e) {
    if (e instanceof UnsupportedExtractError) {
      return `${e.message}\n文件已保存在服务端，你可改用 .txt / .md 上传。`;
    }
    throw e;
  }

  const client = createEmbeddingClient();
  const idPrefix = `personal-${event.messageId}`;
  const { chunkCount } = await ingestPersonalPlainText(client, text, {
    sourceLabel: att.fileName,
    sourcePath: join("data", "uploads", localName),
    idPrefix,
  });

  if (chunkCount === 0) {
    return "文件内容为空，未写入知识库。";
  }

  if (process.env.DEBUG_RAG === "1") {
    console.log(
      `[file-upload] personal 入库 ${chunkCount} 块，来源=${att.fileName} messageId=${event.messageId}`,
    );
  }

  return [
    `已接收「${att.fileName}」，并写入你的个人知识库（${chunkCount} 条文本块）。`,
    `你可以直接提问，我会结合刚上传的内容与预置知识回答（职位招聘信息库不参与本轮对话检索）。`,
  ].join("\n");
}
