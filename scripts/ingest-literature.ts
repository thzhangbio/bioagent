import "dotenv/config";

import { runKnowledgeImporter } from "../tools/knowledge-importer/pyramid/knowledge-importer.js";

async function main(): Promise<void> {
  const input = process.env.LITERATURE_INBOX?.trim() || "data/knowledge/literature-inbox";
  const context = await runKnowledgeImporter({
    argv: ["run", "--source", "literature_kb", "--input", input],
    cwd: process.cwd(),
    command: "run",
    source: "literature_kb",
    input,
    collection: "literature",
    mode: "upsert-by-source-id",
  });

  console.log(`文献入库完成：${context.normalizedDocumentCount ?? 0} 个文档，${context.chunkRecordCount ?? 0} 个块`);
  if (context.manifestPath) {
    console.log(`manifest: ${context.manifestPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
