import { randomUUID } from "node:crypto";

import { getFeishuClient } from "./feishu-client.js";

function isTransientFeishuNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /TLS|ECONNRESET|ETIMEDOUT|socket disconnected|ENOTFOUND|ECONNREFUSED|timeout|UND_ERR_SOCKET|fetch failed/i.test(
    msg,
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 飞书 OpenAPI 偶发 TLS/断连，短重试可提高写入成功率 */
async function withFeishuRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const max = Math.max(1, Number(process.env.FEISHU_API_MAX_RETRIES ?? 4));
  let last: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransientFeishuNetworkError(e) || attempt === max - 1) {
        throw e;
      }
      const ms = 400 * (attempt + 1);
      console.warn(
        `[docx] ${label} 网络可重试错误，${ms}ms 后重试 (${attempt + 1}/${max}):`,
        e instanceof Error ? e.message.slice(0, 160) : e,
      );
      await sleep(ms);
    }
  }
  throw last;
}

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
  return withFeishuRetry("document.create", async () => {
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
  });
}

/**
 * 列出文档块，查找 **页面根块**（`block_type === 1`），用于在其下插入子块。
 */
export async function findDocumentPageRootBlockId(
  documentId: string,
): Promise<string> {
  return withFeishuRetry("documentBlock.list", async () => {
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
  });
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
/**
 * 获取新版云文档全文纯文本（飞书 docx `document.raw_content`）。
 * @see https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/document-docx/docx-v1/document/raw_content
 */
export async function getDocumentPlainText(documentId: string): Promise<string> {
  return withFeishuRetry("document.rawContent", async () => {
    const client = getFeishuClient();
    const res = await client.docx.v1.document.rawContent({
      path: { document_id: documentId },
    });
    assertOk(res, "docx.document.rawContent");
    return (res.data?.content ?? "").replace(/\r\n/g, "\n");
  });
}

/**
 * 清空页面根块下**直接子块**（分页删除，兼容子块较多时），返回最新 `document_revision_id`（若有）。
 */
async function clearPageDirectChildren(options: {
  documentId: string;
  pageBlockId: string;
  initialRevisionId?: number;
}): Promise<number | undefined> {
  let revisionId = options.initialRevisionId;
  for (let safety = 0; safety < 500; safety++) {
    const page = await withFeishuRetry("documentBlockChildren.get", async () => {
      const client = getFeishuClient();
      const res = await client.docx.v1.documentBlockChildren.get({
        path: {
          document_id: options.documentId,
          block_id: options.pageBlockId,
        },
        params: {
          page_size: 50,
          document_revision_id: revisionId,
        },
      });
      assertOk(res, "docx.documentBlockChildren.get");
      return res;
    });
    const items = page.data?.items ?? [];
    if (items.length === 0) return revisionId;

    const batchSize = items.length;
    const del = await withFeishuRetry("documentBlockChildren.batchDelete", async () => {
      const client = getFeishuClient();
      const res = await client.docx.v1.documentBlockChildren.batchDelete({
        path: {
          document_id: options.documentId,
          block_id: options.pageBlockId,
        },
        data: {
          start_index: 0,
          end_index: batchSize,
        },
        params: {
          document_revision_id: revisionId,
          client_token: randomUUID(),
        },
      });
      assertOk(res, "docx.documentBlockChildren.batchDelete");
      return res;
    });
    revisionId = del.data?.document_revision_id ?? revisionId;
  }
  throw new Error("docx: 清空页面子块重试次数过多");
}

/**
 * 用纯文本**替换**文档页面内正文：先清空页面根下子块，再按空行分段写入（与 `createDocumentWithPlainText` 一致）。
 */
export async function replaceDocumentPagePlainText(
  documentId: string,
  body: string,
): Promise<{ documentRevisionId?: number }> {
  const pageId = await findDocumentPageRootBlockId(documentId);
  let revisionId: number | undefined;
  try {
    const docMeta = await withFeishuRetry("document.get", async () => {
      const client = getFeishuClient();
      const res = await client.docx.v1.document.get({
        path: { document_id: documentId },
      });
      assertOk(res, "docx.document.get");
      return res;
    });
    revisionId = docMeta.data?.document?.revision_id;
  } catch {
    /* 无版本号时仍尝试清空/写入 */
  }

  revisionId = await clearPageDirectChildren({
    documentId,
    pageBlockId: pageId,
    initialRevisionId: revisionId,
  });

  const paragraphs = splitPlainTextToParagraphs(body);
  await appendTextParagraphsToBlock({
    documentId,
    parentBlockId: pageId,
    paragraphs,
    index: 0,
    documentRevisionId: revisionId,
  });

  try {
    const after = await withFeishuRetry("document.get", async () => {
      const client = getFeishuClient();
      const res = await client.docx.v1.document.get({
        path: { document_id: documentId },
      });
      assertOk(res, "docx.document.get");
      return res;
    });
    return {
      documentRevisionId: after.data?.document?.revision_id,
    };
  } catch {
    return {};
  }
}

export async function appendTextParagraphsToBlock(options: {
  documentId: string;
  parentBlockId: string;
  paragraphs: string[];
  /** 插入位置；默认 0（顶部子块） */
  index?: number;
  documentRevisionId?: number;
}): Promise<void> {
  await withFeishuRetry("documentBlockChildren.create", async () => {
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
  });
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
    await withFeishuRetry("permissionMember.create", async () => {
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
    });
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
