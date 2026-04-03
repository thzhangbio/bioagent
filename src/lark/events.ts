import * as Lark from "@larksuiteoapi/node-sdk";
import { EventEmitter } from "node:events";

import { handleContentCreateCardEvent } from "./content-create-card-flow.js";

export interface LarkMessageEvent {
  eventType: string;
  messageId: string;
  chatId: string;
  chatType: "p2p" | "group";
  senderId: string;
  messageType: string;
  content: string;
  /** 用户发送文件消息时存在（`message_type` 一般为 `file`） */
  attachment?: {
    fileKey: string;
    fileName: string;
  };
  raw: Record<string, unknown>;
}

export class LarkEventBridge extends EventEmitter {
  private wsClient: Lark.WSClient | null = null;

  start(): void {
    if (this.wsClient) return;

    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("[lark-event] 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET");
      process.exit(1);
    }

    const baseConfig = { appId, appSecret };

    console.log("[lark-event] 使用飞书 SDK WebSocket 建立长连接...");

    const eventDispatcher = new Lark.EventDispatcher({}).register({
      "im.message.receive_v1": async (data: any) => {
        try {
          if (process.env.DEBUG_LARK === "1") {
            console.log("[lark-event][debug] 回调 keys:", Object.keys(data || {}));
          }

          const event = this.parseSDKEvent(data);
          if (!event) {
            console.warn(
              "[lark-event] 已收到 im.message.receive_v1，但未能解析出 message（请设 DEBUG_LARK=1 查看结构）"
            );
            return;
          }

          const preview = event.attachment ?
            `[文件] ${event.attachment.fileName}`
          : event.content.slice(0, 50);
          console.log(
            `[lark-event] 收到消息: ${event.chatType === "p2p" ? "私聊" : "群聊"} | ${preview}`,
          );
          this.emit("message", event);
        } catch (err) {
          console.error("[lark-event] 事件处理异常:", err);
        }
      },
      // 开放平台若订阅了「消息已读」，需占位处理，否则 SDK 会 warn: no handle
      "im.message.message_read_v1": async () => {},
      /** 交互卡片按钮 / 表单提交（需在开放平台订阅「卡片回传交互」并启用长连接） */
      "card.action.trigger": async (data: unknown) => {
        if (process.env.FEISHU_CONTENT_CARD_FORM !== "1") {
          return undefined;
        }
        try {
          return await handleContentCreateCardEvent(data as Record<string, unknown>);
        } catch (e) {
          console.error("[lark-event] card.action.trigger 处理失败:", e);
          return undefined;
        }
      },
    });

    this.wsClient = new Lark.WSClient({
      ...baseConfig,
      // debug 时可看到 [ws] receive message ... 与分片合并情况
      loggerLevel:
        process.env.DEBUG_LARK === "1" ? Lark.LoggerLevel.debug : Lark.LoggerLevel.info,
    });

    this.wsClient.start({ eventDispatcher });
  }

  stop(): void {
    this.wsClient = null;
  }

  private parseSDKEvent(data: any): LarkMessageEvent | null {
    const message = data?.message ?? data?.event?.message;
    if (!message) return null;

    const sender = data.sender ?? data.event?.sender;

    // 集群模式下仅一个连接能收到事件；忽略机器人自己发出的消息，避免自触发
    if (sender?.sender_type === "app") {
      console.log("[lark-event] 跳过机器人自身消息");
      return null;
    }

    const messageId: string = message.message_id ?? "";
    const chatId: string = message.chat_id ?? "";
    const chatType: "p2p" | "group" = message.chat_type ?? "p2p";
    const messageType: string = message.message_type ?? "text";

    const senderId: string = sender?.sender_id?.open_id ?? "";

    let content = "";
    let attachment: LarkMessageEvent["attachment"];
    try {
      const parsed = JSON.parse(message.content ?? "{}");
      content = parsed.text ?? "";
      const fk = parsed.file_key ?? parsed.fileKey;
      if (typeof fk === "string" && fk.length > 0) {
        attachment = {
          fileKey: fk,
          fileName: String(parsed.file_name ?? parsed.fileName ?? "file"),
        };
      }
    } catch {
      content = message.content ?? "";
    }

    if (!messageId) return null;
    if (!content?.trim() && !attachment) return null;

    return {
      eventType: "im.message.receive_v1",
      messageId,
      chatId,
      chatType,
      senderId,
      messageType,
      content,
      attachment,
      raw: data,
    };
  }
}
