import * as Lark from "@larksuiteoapi/node-sdk";

let httpClient: Lark.Client | null = null;

export function getFeishuClient(): Lark.Client {
  if (!httpClient) {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("FEISHU_APP_ID / FEISHU_APP_SECRET 未配置");
    }
    httpClient = new Lark.Client({ appId, appSecret });
  }
  return httpClient;
}
