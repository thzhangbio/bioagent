import "dotenv/config";
import { LarkEventBridge, type LarkMessageEvent } from "./lark/events.js";
import { handleUserFileMessage } from "./lark/file-upload-handler.js";
import { replyMessage, sendMessage } from "./lark/messages.js";
import { handleUserMessage } from "./agent/router.js";
import { acquireFeishuWsLock } from "./lark/ws-lock.js";

const bridge = new LarkEventBridge();

const processedMessages = new Set<string>();
const MESSAGE_DEDUP_TTL = 60_000;

bridge.on("message", async (event: LarkMessageEvent) => {
  if (processedMessages.has(event.messageId)) return;
  processedMessages.add(event.messageId);
  setTimeout(() => processedMessages.delete(event.messageId), MESSAGE_DEDUP_TTL);

  if (event.attachment) {
    const chatKey = event.chatId || event.senderId;
    console.log(`\n[main] 处理文件消息 chatKey=${chatKey}`);
    try {
      const reply = await handleUserFileMessage(event);
      console.log(`[main] 文件处理回复: ${reply.slice(0, 120)}...`);
      if (event.messageId) {
        await replyMessage({ messageId: event.messageId, markdown: reply });
      } else if (event.chatId) {
        await sendMessage({ chatId: event.chatId, markdown: reply });
      }
    } catch (err) {
      console.error("[main] 处理文件失败:", err);
      const fallback = "文件处理失败，请稍后重试或换用 .txt / .md 上传。";
      if (event.messageId) {
        await replyMessage({ messageId: event.messageId, text: fallback });
      } else if (event.chatId) {
        await sendMessage({ chatId: event.chatId, text: fallback });
      }
    }
    return;
  }

  if (!event.content?.trim()) return;

  const chatKey = event.chatId || event.senderId;
  console.log(`\n[main] 处理消息 chatKey=${chatKey}`);
  console.log(`[main] 用户: ${event.content}`);

  try {
    const reply = await handleUserMessage(chatKey, event.content, {
      senderOpenId: event.senderId || undefined,
    });
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

bridge.on("error", (err: Error) => {
  console.error("[main] 事件桥异常:", err.message);
});

function validateEnv(): void {
  const required = ["ANTHROPIC_API_KEY", "FEISHU_APP_ID", "FEISHU_APP_SECRET"];
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
console.log("========================================");
console.log(
  "[config] Claude 模型:",
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6（.env 未设置则走代码默认）"
);
console.log("[config] 发消息已改为飞书 SDK（不再依赖 lark-cli 身份）");
console.log(
  "[config] 提示：同一应用只允许一个长连接收事件；请关闭其它终端里的 lark-cli event / 重复 pnpm start"
);
console.log("[config] 排查时可执行: DEBUG_LARK=1 pnpm start");
console.log(
  "[config] RAG：需 OPENAI_API_KEY + 已执行 ingest:all；对话检索不含 job_post；文件上传见 data/uploads/",
);
console.log("[config] 独立探测长连接: pnpm run probe:feishu（需先停掉本服务）\n");
console.log("[config] FEISHU_APP_ID =", process.env.FEISHU_APP_ID);

acquireFeishuWsLock();
bridge.start();
