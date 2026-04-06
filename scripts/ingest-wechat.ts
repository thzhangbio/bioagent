import "dotenv/config";

import { runKnowledgeImporter } from "../tools/knowledge-importer/pyramid/knowledge-importer.js";

async function main(): Promise<void> {
  const input =
    process.env.WECHAT_STYLE_INBOX?.trim() ||
    "side-tools/wechat-article-cleanup/out";
  const context = await runKnowledgeImporter({
    argv: ["run", "--source", "wechat_style", "--input", input],
    cwd: process.cwd(),
    command: "run",
    source: "wechat_style",
    input,
    collection: "wechat_style",
    mode: "replace-collection",
  });

  console.log(`微信风格入库完成：${context.normalizedDocumentCount ?? 0} 个文档，${context.chunkRecordCount ?? 0} 个块`);
  if (context.manifestPath) {
    console.log(`manifest: ${context.manifestPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
