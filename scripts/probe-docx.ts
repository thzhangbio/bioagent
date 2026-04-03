/**
 * 飞书新版云文档（docx）创建 + 写入探活。
 * 用法:
 *   pnpm run probe:docx
 *   pnpm run probe:docx -- "自定义标题" "第一段\n\n第二段"
 *
 * 依赖：`.env` 中 FEISHU_APP_ID / FEISHU_APP_SECRET；可选 FEISHU_DOC_FOLDER_TOKEN（父目录 token）、FEISHU_WEB_BASE。
 */
import "dotenv/config";

import { createDocumentWithPlainText } from "../src/lark/docx-document.js";

function parseBody(): { title: string; body: string } {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  if (argv.length >= 2) {
    return { title: argv[0]!, body: argv[1]!.replace(/\\n/g, "\n") };
  }
  if (argv.length === 1) {
    return {
      title: argv[0]!,
      body: ["探活正文第一段。", "", `时间：${new Date().toISOString()}`].join(
        "\n",
      ),
    };
  }
  return {
    title: "bioagent docx 探活",
    body: ["第一段。", "", "第二段（若本行可见，说明写入成功）。", "", `UTC ${new Date().toISOString()}`].join(
      "\n",
    ),
  };
}

async function main(): Promise<void> {
  if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
    console.error("请配置 FEISHU_APP_ID / FEISHU_APP_SECRET（见 .env.example）");
    process.exit(1);
  }

  const { title, body } = parseBody();
  const folderToken = process.env.FEISHU_DOC_FOLDER_TOKEN;

  console.log("创建文档:", title);
  if (folderToken) console.log("父目录 token: 已设置 FEISHU_DOC_FOLDER_TOKEN");

  const result = await createDocumentWithPlainText(title, body, {
    folderToken: folderToken || undefined,
  });

  console.log("document_id:", result.documentId);
  console.log("url:", result.url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
