/**
 * 2.0 E：默认不在终端打印用户/助手全文；排障时设 DEBUG_CONTENT=1。
 */
const DEFAULT_PREVIEW_CHARS = 80;

export function isDebugContentLogEnabled(): boolean {
  return process.env.DEBUG_CONTENT === "1";
}

/**
 * 单行日志用：默认返回「标签 + 字符长度 + 前缀预览」；DEBUG_CONTENT=1 时返回原文。
 */
export function formatForPrivacyLog(text: string, label = "text"): string {
  if (isDebugContentLogEnabled()) return text;
  const t = text ?? "";
  const n = t.length;
  if (n === 0) return `${label}=(empty)`;
  const preview = t.slice(0, DEFAULT_PREVIEW_CHARS);
  const more = n > DEFAULT_PREVIEW_CHARS ? "…" : "";
  return `${label} len=${n} preview=${JSON.stringify(preview + more)}`;
}
