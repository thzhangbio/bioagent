import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";

export interface LarkMessageEvent {
  eventType: string;
  messageId: string;
  chatId: string;
  chatType: "p2p" | "group";
  senderId: string;
  messageType: string;
  content: string;
  raw: Record<string, unknown>;
}

export class LarkEventBridge extends EventEmitter {
  private process: ChildProcess | null = null;

  start(eventTypes = "im.message.receive_v1"): void {
    if (this.process) return;

    const args = [
      "event",
      "+subscribe",
      "--event-types",
      eventTypes,
      "--compact",
    ];

    console.log(`[lark-event] 启动事件监听: lark-cli ${args.join(" ")}`);
    this.process = spawn("lark-cli", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => this.handleLine(line));

    this.process.stderr?.on("data", (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[lark-event] ${msg}`);
    });

    this.process.on("close", (code) => {
      console.log(`[lark-event] 进程退出 code=${code}`);
      this.process = null;
      this.emit("close", code);
    });

    this.process.on("error", (err) => {
      console.error("[lark-event] 进程错误:", err.message);
      this.emit("error", err);
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;

    try {
      const raw = JSON.parse(line);
      const event = this.parseEvent(raw);
      if (event) {
        console.log(
          `[lark-event] 收到消息: ${event.chatType === "p2p" ? "私聊" : "群聊"} | ${event.content.slice(0, 50)}`
        );
        this.emit("message", event);
      }
    } catch {
      console.warn("[lark-event] 无法解析行:", line.slice(0, 100));
    }
  }

  private parseEvent(raw: Record<string, unknown>): LarkMessageEvent | null {
    const eventType = this.dig(raw, "header.event_type") as string
      ?? this.dig(raw, "event_type") as string
      ?? raw["event_type"] as string;

    if (!eventType?.includes("im.message")) return null;

    const event = (raw["event"] ?? raw) as Record<string, unknown>;
    const message = (event["message"] ?? {}) as Record<string, unknown>;
    const sender = (event["sender"] ?? {}) as Record<string, unknown>;
    const senderId = (sender["sender_id"] ?? sender) as Record<string, unknown>;

    const messageId =
      (message["message_id"] as string) ?? (raw["message_id"] as string) ?? "";
    const chatId =
      (message["chat_id"] as string) ?? (raw["chat_id"] as string) ?? "";
    const chatType =
      ((message["chat_type"] as string) ?? (raw["chat_type"] as string) ?? "p2p") as
        | "p2p"
        | "group";
    const messageType =
      (message["message_type"] as string) ?? (raw["message_type"] as string) ?? "text";

    let content = "";
    const rawContent = (message["content"] as string) ?? (raw["content"] as string) ?? (raw["text"] as string) ?? "";
    try {
      const parsed = JSON.parse(rawContent);
      content = parsed.text ?? rawContent;
    } catch {
      content = rawContent;
    }

    if (!content && !messageId) return null;

    return {
      eventType,
      messageId,
      chatId,
      chatType,
      senderId: (senderId["open_id"] as string) ?? (senderId["user_id"] as string) ?? "",
      messageType,
      content,
      raw,
    };
  }

  private dig(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }
}
