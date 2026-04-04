import type { MemoryStore } from "./store.js";

/**
 * 注入 system 的「少而硬」块：最近交付文档、用户明确偏好（短句）。
 */
export function formatStructuredMemoryBlock(memory: MemoryStore): string {
  const lines: string[] = [];

  if (memory.lastDeliveredDoc?.documentId) {
    const d = memory.lastDeliveredDoc;
    lines.push(
      `- 最近交付的新版云文档（docx）：${d.title?.trim() || "（无标题）"}`,
      `  链接：${d.url}`,
      d.createdAt ?
        `  交付时间（UTC）：${d.createdAt}`
      : "",
    );
  } else {
    lines.push("- 最近交付的云文档：（暂无记录；成稿成功后会自动登记）");
  }

  if (memory.contentPreferences?.length) {
    lines.push(
      "- 用户明确偏好（请遵守，若与本轮指令冲突以本轮为准）：",
      ...memory.contentPreferences.map((p, i) => `  ${i + 1}. ${p}`),
    );
  }

  return lines.filter(Boolean).join("\n");
}
