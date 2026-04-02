import { getFeishuClient } from "./feishu-client.js";

interface SendOptions {
  chatId?: string;
  userId?: string;
  text?: string;
  markdown?: string;
}

interface ReplyOptions {
  messageId: string;
  text?: string;
  markdown?: string;
}

function pickBody(opts: { text?: string; markdown?: string }): string {
  const body = opts.markdown ?? opts.text;
  if (!body?.trim()) {
    throw new Error("sendMessage / replyMessage 需要 text 或 markdown");
  }
  return body;
}

/** 文本消息 content 字段（JSON 字符串） */
function textContent(body: string): string {
  return JSON.stringify({ text: body });
}

export async function sendMessage(opts: SendOptions): Promise<string> {
  const body = pickBody(opts);
  const client = getFeishuClient();

  if (opts.chatId) {
    const res = await client.im.v1.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: opts.chatId,
        msg_type: "text",
        content: textContent(body),
      },
    });
    return JSON.stringify(res?.data ?? res);
  }

  if (opts.userId) {
    const res = await client.im.v1.message.create({
      params: { receive_id_type: "open_id" },
      data: {
        receive_id: opts.userId,
        msg_type: "text",
        content: textContent(body),
      },
    });
    return JSON.stringify(res?.data ?? res);
  }

  throw new Error("sendMessage 需要 chatId 或 userId");
}

export async function replyMessage(opts: ReplyOptions): Promise<string> {
  const body = pickBody(opts);
  const client = getFeishuClient();

  const res = await client.im.v1.message.reply({
    path: { message_id: opts.messageId },
    data: {
      msg_type: "text",
      content: textContent(body),
    },
  });

  return JSON.stringify(res?.data ?? res);
}
