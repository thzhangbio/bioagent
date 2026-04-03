/**
 * 写作工作流「是否允许把当前句与历史合并再进 docx」——**显式状态**，不依赖正则猜助手原文。
 * - awaiting_supplement：上一轮是「动笔前追问」或「写入失败待补充」，下一句可合并。
 * - closed：已交付 doc、或未处于等待补充，禁止误合并闲聊。
 */
export type WriteMergeGateState = "closed" | "awaiting_supplement";

const gateByChat = new Map<string, WriteMergeGateState>();

export function getWriteMergeGate(chatId: string): WriteMergeGateState {
  return gateByChat.get(chatId) ?? "closed";
}

/**
 * 根据本轮 `runContentCreateWorkflow` 的回复更新状态（在 router 写入历史前调用）。
 */
export function syncWriteMergeGateFromWorkflowReply(
  chatId: string,
  reply: string,
): void {
  if (/已写好并保存到飞书云文档/.test(reply) && /https?:\/\//.test(reply)) {
    gateByChat.set(chatId, "closed");
    return;
  }
  if (
    (/动笔前需要先对齐下面几项|若补充下面即可动笔|还需要确认这些/.test(
      reply,
    ) ||
      /确认后我再撰写并写入飞书云文档/.test(reply)) &&
    /未确认前不会(?:成稿|杜撰)/.test(reply)
  ) {
    gateByChat.set(chatId, "awaiting_supplement");
    return;
  }
  if (/正文已生成，但写入飞书云文档失败/.test(reply)) {
    gateByChat.set(chatId, "awaiting_supplement");
    return;
  }
  gateByChat.set(chatId, "closed");
}

/** 测试或排障用 */
export function resetWriteMergeGateForTests(chatId?: string): void {
  if (chatId) gateByChat.delete(chatId);
  else gateByChat.clear();
}
