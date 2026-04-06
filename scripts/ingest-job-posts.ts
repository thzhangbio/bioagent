import "dotenv/config";

import { runKnowledgeImporter } from "../tools/knowledge-importer/pyramid/knowledge-importer.js";

async function main(): Promise<void> {
  const context = await runKnowledgeImporter({
    argv: ["run", "--source", "job_posts"],
    cwd: process.cwd(),
    command: "run",
    source: "job_posts",
    collection: "job_post",
    mode: "replace-collection",
  });

  console.log(`岗位库入库完成：${context.normalizedDocumentCount ?? 0} 个文档，${context.chunkRecordCount ?? 0} 个块`);
  if (context.manifestPath) {
    console.log(`manifest: ${context.manifestPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
