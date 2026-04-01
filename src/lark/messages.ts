import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

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

async function run(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await exec("lark-cli", args, {
      timeout: 15_000,
    });
    if (stderr?.trim()) console.log(`[lark-im] ${stderr.trim()}`);
    return stdout.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[lark-im] 执行失败: lark-cli ${args.join(" ")}\n  ${msg}`);
    throw err;
  }
}

export async function sendMessage(opts: SendOptions): Promise<string> {
  const args = ["im", "+messages-send"];

  if (opts.chatId) args.push("--chat-id", opts.chatId);
  else if (opts.userId) args.push("--user-id", opts.userId);
  else throw new Error("sendMessage 需要 chatId 或 userId");

  if (opts.markdown) args.push("--markdown", opts.markdown);
  else if (opts.text) args.push("--text", opts.text);
  else throw new Error("sendMessage 需要 text 或 markdown");

  return run(args);
}

export async function replyMessage(opts: ReplyOptions): Promise<string> {
  const args = ["im", "+messages-reply", "--message-id", opts.messageId];

  if (opts.markdown) args.push("--markdown", opts.markdown);
  else if (opts.text) args.push("--text", opts.text);
  else throw new Error("replyMessage 需要 text 或 markdown");

  return run(args);
}
