import { randomUUID } from "node:crypto";

import { getFeishuClient } from "./feishu-client.js";

/** 飞书 docx 块类型（常用）：页面、文本段落 */
const BLOCK_TYPE_PAGE = 1;
const BLOCK_TYPE_TEXT = 2;

/** 单块文本元素大致上限，避免单次请求过大（官方另有总限频） */
const MAX_TEXT_RUN_CHARS = 8000;

export interface CreateDocumentOptions {
  /** 文档标题 */
  title?: string;
  /** 云空间父目录 token；不传则在应用身份默认位置创建 */
  folderToken?: string;
}

export interface CreateDocumentResult {
  documentId: string;
  revisionId?: number;
  title?: string;
}

export interface PlainTextDocumentOptions extends Pick<CreateDocumentOptions, "folderToken"> {
  /** 对话用户 open_id：创建成功后为其添加云文档「可管理」协作者权限，便于用户自行编辑 */
  grantEditToOpenId?: string;
}

function assertOk<T extends { code?: number; msg?: string }>(
  res: T,
  action: string,
): void {
  if (res.code !== undefined && res.code !== 0) {
    throw new Error(`${action} 失败: ${res.msg ?? "unknown"} (code=${res.code})`);
  }
}

/**
 * 创建空白新版云文档（docx）。
 * @see https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-v1/document/create
 */
export async function createCloudDocument(
  options: CreateDocumentOptions = {},
): Promise<CreateDocumentResult> {
  const client = getFeishuClient();
  const res = await client.docx.v1.document.create({
    data: {
      title: options.title,
      folder_token: options.folderToken,
    },
  });
  assertOk(res, "docx.document.create");
  const doc = res.data?.document;
  const documentId = doc?.document_id;
  if (!documentId) {
    throw new Error("docx.document.create: 未返回 document_id");
  }
  return {
    documentId,
    revisionId: doc?.revision_id,
    title: doc?.title,
  };
}

/**
 * 列出文档块，查找 **页面根块**（`block_type === 1`），用于在其下插入子块。
 */
export async function findDocumentPageRootBlockId(
  documentId: string,
): Promise<string> {
  const client = getFeishuClient();
  const res = await client.docx.v1.documentBlock.list({
    path: { document_id: documentId },
    params: { page_size: 50 },
  });
  assertOk(res, "docx.documentBlock.list");
  const items = res.data?.items;
  if (!items?.length) {
    throw new Error("docx.documentBlock.list: 文档无块");
  }
  const page = items.find((i) => i.block_type === BLOCK_TYPE_PAGE) ?? items[0];
  const id = page?.block_id;
  if (!id) {
    throw new Error("docx: 无法解析页面 block_id");
  }
  return id;
}

function splitPlainTextToParagraphs(body: string): string[] {
  const t = body.replace(/\r\n/g, "\n").trim();
  if (!t) return [""];
  const parts = t.split(/\n{2,}/);
  const out: string[] = [];
  for (let p of parts) {
    while (p.length > MAX_TEXT_RUN_CHARS) {
      out.push(p.slice(0, MAX_TEXT_RUN_CHARS));
      p = p.slice(MAX_TEXT_RUN_CHARS);
    }
    out.push(p);
  }
  return out;
}

/**
 * 在指定父块下追加多个 **文本段落**（`block_type: 文本`）。
 */
export async function appendTextParagraphsToBlock(options: {
  documentId: string;
  parentBlockId: string;
  paragraphs: string[];
  /** 插入位置；默认 0（顶部子块） */
  index?: number;
  documentRevisionId?: number;
}): Promise<void> {
  const client = getFeishuClient();
  const children = options.paragraphs.map((content) => ({
    block_type: BLOCK_TYPE_TEXT,
    text: {
      elements: [{ text_run: { content } }],
    },
  }));

  const res = await client.docx.v1.documentBlockChildren.create({
    path: {
      document_id: options.documentId,
      block_id: options.parentBlockId,
    },
    data: {
      children,
      index: options.index ?? 0,
    },
    params: {
      document_revision_id: options.documentRevisionId,
      client_token: randomUUID(),
    },
  });
  assertOk(res, "docx.documentBlockChildren.create");
}

/**
 * 为指定用户（open_id）增加云文档协作者权限：`full_access`（飞书侧「可管理」，含编辑、分享等，具体以租户策略为准）。
 * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/permission-member/create
 */
export async function grantDocxCollaboratorFullAccess(
  documentToken: string,
  userOpenId: string,
): Promise<boolean> {
  const id = userOpenId.trim();
  if (!id) return false;
  if (process.env.FEISHU_DOC_DISABLE_USER_GRANT === "1") {
    console.log("[docx] 已跳过授予用户协作者（FEISHU_DOC_DISABLE_USER_GRANT=1）");
    return false;
  }
  try {
    const client = getFeishuClient();
    const res = await client.drive.permissionMember.create({
      path: { token: documentToken },
      params: { type: "docx", need_notification: false },
      data: {
        member_type: "openid",
        member_id: id,
        perm: "full_access",
        type: "user",
      },
    });
    assertOk(res, "drive.permissionMember.create");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[docx] 授予用户协作者权限失败:", msg);
    return false;
  }
}

/**
 * 创建云文档并写入纯文本正文（按空行分段；超长段会截断为多块）。
 */
export async function createDocumentWithPlainText(
  title: string,
  body: string,
  options: PlainTextDocumentOptions = {},
): Promise<
  CreateDocumentResult & { url: string; collaboratorGranted?: boolean }
> {
  const created = await createCloudDocument({
    title,
    folderToken: options.folderToken,
  });
  const pageId = await findDocumentPageRootBlockId(created.documentId);
  const paragraphs = splitPlainTextToParagraphs(body);
  await appendTextParagraphsToBlock({
    documentId: created.documentId,
    parentBlockId: pageId,
    paragraphs,
    index: 0,
    documentRevisionId: created.revisionId,
  });
  let collaboratorGranted: boolean | undefined;
  if (options.grantEditToOpenId) {
    collaboratorGranted = await grantDocxCollaboratorFullAccess(
      created.documentId,
      options.grantEditToOpenId,
    );
  }
  return {
    ...created,
    url: buildDocxWebUrl(created.documentId),
    collaboratorGranted,
  };
}

/**
 * 浏览器打开用的云文档链接（`document_id` 即 URL 中的 docx token）。
 * 域名可通过环境变量 `FEISHU_WEB_BASE` 覆盖，例如 `https://sample.feishu.cn`。
 */
export function buildDocxWebUrl(documentId: string): string {
  const base =
    process.env.FEISHU_WEB_BASE?.replace(/\/$/, "") ?? "https://feishu.cn";
  return `${base}/docx/${documentId}`;
}

export { BLOCK_TYPE_PAGE, BLOCK_TYPE_TEXT };
