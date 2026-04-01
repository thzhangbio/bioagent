import "dotenv/config";
import { LarkEventBridge, type LarkMessageEvent } from "./lark/events.js";
import { replyMessage, sendMessage } from "./lark/messages.js";
import { handleUserMessage } from "./agent/router.js";

const bridge = new LarkEventBridge();

const processedMessages = new Set<string>();
const MESSAGE_DEDUP_TTL = 60_000;

bridge.on("message", async (event: LarkMessageEvent) => {
  if (processedMessages.has(event.messageId)) return;
  processedMessages.add(event.messageId);
  setTimeout(() => processedMessages.delete(event.messageId), MESSAGE_DEDUP_TTL);

  if (!event.content?.trim()) return;

  const chatKey = event.chatId || event.senderId;
  console.log(`\n[main] 处理消息 chatKey=${chatKey}`);
  console.log(`[main] 用户: ${event.content}`);

  try {
    const reply = await handleUserMessage(chatKey, event.content);
    console.log(`[main] 回复: ${reply.slice(0, 100)}...`);

    if (event.messageId) {
      await replyMessage({ messageId: event.messageId, markdown: reply });
    } else if (event.chatId) {
      await sendMessage({ chatId: event.chatId, markdown: reply });
    }
  } catch (err) {
    console.error("[main] 处理消息失败:", err);
    try {
      const fallback = "抱歉，处理过程中出现了问题，请稍后重试。";
      if (event.messageId) {
        await replyMessage({ messageId: event.messageId, text: fallback });
      } else if (event.chatId) {
        await sendMessage({ chatId: event.chatId, text: fallback });
      }
    } catch {
      console.error("[main] 发送错误回复也失败了");
    }
  }
});

bridge.on("close", (code: number) => {
  console.log(`[main] 事件连接断开 (code=${code})，3秒后重连...`);
  setTimeout(() => bridge.start(), 3000);
});

bridge.on("error", (err: Error) => {
  console.error("[main] 事件桥异常:", err.message);
});

function validateEnv(): void {
  const required = ["ANTHROPIC_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n[启动失败] 缺少环境变量: ${missing.join(", ")}`);
    console.error("请复制 .env.example 为 .env 并填入对应值\n");
    process.exit(1);
  }
}

validateEnv();
console.log("\n========================================");
console.log("  医学编辑 AI 员工 v0.1 — 里程碑 1");
console.log("========================================\n");
bridge.start();
