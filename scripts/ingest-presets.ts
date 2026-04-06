import "dotenv/config";

import { runKnowledgeImporter } from "../tools/knowledge-importer/pyramid/knowledge-importer.js";

async function main(): Promise<void> {
  const context = await runKnowledgeImporter({
    argv: ["run", "--source", "presets"],
    cwd: process.cwd(),
    command: "run",
    source: "presets",
    mode: "replace-collection",
  });

  console.log(`预置入库完成：${context.normalizedDocumentCount ?? 0} 个文档，${context.chunkRecordCount ?? 0} 个块`);
  if (context.manifestPath) {
    console.log(`manifest: ${context.manifestPath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
