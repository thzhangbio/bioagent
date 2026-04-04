import { existsSync } from "node:fs";

import { createEmbeddingClient } from "../knowledge/embeddings.js";
import { CHAT_RAG_DEFAULT_COLLECTIONS } from "../knowledge/rag-default-collections.js";
import { DEFAULT_RAG_STORE_PATH } from "../knowledge/paths.js";
import { retrieve } from "../knowledge/retrieve.js";

/**
 * 用检索片段包裹用户当前问句，供 Claude 参考（失败时原样返回）。
 */
export async function augmentUserTextWithRag(userText: string): Promise<string> {
  const trimmed = userText.trim();
  if (!trimmed) return userText;
  if (!process.env.OPENAI_API_KEY || !existsSync(DEFAULT_RAG_STORE_PATH)) {
    return userText;
  }

  try {
    const client = createEmbeddingClient();
    const hits = await retrieve(client, trimmed, {
      collections: [...CHAT_RAG_DEFAULT_COLLECTIONS],
      topK: 8,
    });
    if (hits.length === 0) return userText;

    const block = hits
      .map((h, i) => {
        const ref =
          h.chunk.sourceUrl ?
            `${h.chunk.sourceLabel} | ${h.chunk.sourceUrl}`
          : h.chunk.paperId ?
            `${h.chunk.sourceLabel} | id:${h.chunk.paperId}`
          : h.chunk.sourceLabel;
        const styleTag =
          h.chunk.collection === "wechat_style" && h.chunk.wechatStyleVariant ?
            ` | style:${h.chunk.wechatStyleVariant}`
          : "";
        return `[#${i + 1} ${h.chunk.collection}${styleTag} | ${ref}]\n${h.chunk.text}`;
      })
      .join("\n\n---\n\n");

    return [
      "【知识库检索片段（仅供引用；若与事实冲突以用户最新说明为准）】",
      block,
      "【用户原话】",
      trimmed,
    ].join("\n\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[rag-context] 检索失败，回退无 RAG:", msg);
    return userText;
  }
}
