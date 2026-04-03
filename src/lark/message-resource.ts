import { getFeishuClient } from "./feishu-client.js";

/**
 * 下载用户消息中的文件资源到本地路径（需机器人与消息在同一会话）。
 * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-resource/get
 */
export async function downloadMessageFileResource(
  messageId: string,
  fileKey: string,
  destPath: string,
): Promise<void> {
  const client = getFeishuClient();
  const res = await client.im.v1.messageResource.get({
    path: { message_id: messageId, file_key: fileKey },
    params: { type: "file" },
  });
  await res.writeFile(destPath);
}
