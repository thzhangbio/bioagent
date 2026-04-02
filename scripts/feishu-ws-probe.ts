/**
 * 仅测试飞书长连接是否能把 im.message.receive_v1 推到本进程。
 * 用法（项目根目录）:
 *   pnpm exec tsx scripts/feishu-ws-probe.ts
 * 或:
 *   DEBUG_LARK=1 pnpm exec tsx scripts/feishu-ws-probe.ts
 *
 * 给机器人发一条私聊后，终端应打印「probe: 收到事件」；若始终没有，说明事件被其它连接抢走或网络/凭证问题。
 */
import "dotenv/config";
import * as Lark from "@larksuiteoapi/node-sdk";

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;

if (!appId || !appSecret) {
  console.error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET（读 .env）");
  process.exit(1);
}

console.log("[probe] appId =", appId);
console.log("[probe] 正在建立 WebSocket，给机器人发一条私聊消息…\n");

const dispatcher = new Lark.EventDispatcher({}).register({
  "im.message.receive_v1": async (data: unknown) => {
    console.log("[probe] 收到 im.message.receive_v1");
    console.log(JSON.stringify(data, null, 2).slice(0, 4000));
    process.exit(0);
  },
});

const ws = new Lark.WSClient({
  appId,
  appSecret,
  loggerLevel:
    process.env.DEBUG_LARK === "1"
      ? Lark.LoggerLevel.debug
      : Lark.LoggerLevel.info,
});

ws.start({ eventDispatcher: dispatcher });

setTimeout(() => {
  console.log(
    "\n[probe] 60 秒内未收到任何消息事件。请确认：\n" +
      "  1) 全机只有一个长连接（无其它 pnpm start / lark-cli event）\n" +
      "  2) .env 的 FEISHU_APP_ID 与开放平台应用一致\n" +
      "  3) 事件订阅为「长连接」且已发布\n"
  );
  process.exit(2);
}, 60_000);
