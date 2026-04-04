/**
 * 调用 im.v1.message.list 拉取会话历史，解析 docx 链接并写入 data/chat-docx-index/<chatId>.json。
 *
 * 用法:
 *   pnpm run refresh:chat-docx-index -- --chat-id oc_xxx
 *   FEISHU_TEST_CHAT_ID=oc_xxx pnpm run refresh:chat-docx-index
 *
 * 可选: --max-pages N（默认读 FEISHU_CHAT_DOCX_HISTORY_PAGES，否则 8）
 */
import "dotenv/config";

import {
  loadChatDocxIndex,
  refreshChatDocxIndexFromHistory,
} from "../src/memory/chat-docx-index.js";

function parseArgs(): { chatId: string; maxPages: number } {
  const argv = process.argv.slice(2);
  let chatId = (process.env.FEISHU_TEST_CHAT_ID ?? process.env.FEISHU_CHAT_ID ?? "").trim();
  let maxPages = Number(process.env.FEISHU_CHAT_DOCX_HISTORY_PAGES ?? 8);
  if (!Number.isFinite(maxPages) || maxPages < 1) maxPages = 8;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--chat-id" && argv[i + 1]) {
      chatId = argv[++i]!.trim();
    } else if (argv[i] === "--max-pages" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n >= 1) maxPages = n;
    }
  }

  return { chatId, maxPages: Math.min(20, Math.max(1, maxPages)) };
}

async function main(): Promise<void> {
  if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
    console.error("请配置 FEISHU_APP_ID / FEISHU_APP_SECRET（见 .env.example）");
    process.exit(1);
  }

  const { chatId, maxPages } = parseArgs();
  if (!chatId) {
    console.error("请指定会话: --chat-id oc_xxx");
    console.error("或设置 FEISHU_TEST_CHAT_ID / FEISHU_CHAT_ID");
    process.exit(1);
  }

  console.log(`拉取会话历史并合并 docx 索引: chatId=${chatId}, maxPages=${maxPages}`);
  const r = await refreshChatDocxIndexFromHistory(chatId, { maxPages });
  console.log("完成:", r);

  const idx = loadChatDocxIndex(chatId);
  console.log(`索引条目数: ${idx.entries.length}`);
  for (const e of idx.entries) {
    console.log(`  ${e.documentId}  ${e.url}  (${e.source ?? "?"})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
