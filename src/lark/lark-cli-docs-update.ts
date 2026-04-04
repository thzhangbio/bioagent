import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 改稿失败回退到 Node SDK 纯文本时，粗略去掉常见 Markdown 标记 */
export function stripMarkdownToPlainFallback(md: string): string {
  let s = md.replace(/\r\n/g, "\n");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/^>\s?/gm, "");
  return s.trim();
}

/**
 * 使用本机 `lark-cli docs +update --mode overwrite` 将 **Lark-flavored Markdown** 写回云文档。
 * 需已安装并登录 lark-cli（与飞书开放平台 / MCP 能力一致，见 lark-doc skill）。
 *
 * @see https://open.feishu.cn — 文档权限以 CLI 当前身份为准（`--as user|bot`）
 */
export async function replaceDocumentViaLarkCliOverwrite(
  documentId: string,
  markdown: string,
  options: { newTitle?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  const bin = process.env.LARK_CLI_BIN ?? "lark-cli";
  const asArg = process.env.LARK_CLI_AS ?? "user";
  const args = [
    "docs",
    "+update",
    "--as",
    asArg,
    "--doc",
    documentId.trim(),
    "--mode",
    "overwrite",
    "--markdown",
    markdown,
  ];
  if (options.newTitle?.trim()) {
    args.push("--new-title", options.newTitle.trim());
  }

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env },
    });
    const out = `${stdout}`.trim();
    const err = `${stderr}`.trim();
    const combined = `${out}\n${err}`.trim();
    if (/\"error\"\s*:/.test(combined) || /\[错误码\]/.test(combined)) {
      const snippet = combined.slice(0, 800);
      throw new Error(`lark-cli docs +update 可能失败: ${snippet}`);
    }
    return { stdout: out, stderr: err };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`lark-cli 执行失败 (${bin}): ${msg}`);
  }
}
