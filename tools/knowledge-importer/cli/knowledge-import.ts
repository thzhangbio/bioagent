import "dotenv/config";

import { pathToFileURL } from "node:url";

import {
  runKnowledgeImporter,
  type KnowledgeImporterOptions,
} from "../pyramid/knowledge-importer.js";

function printHelp(): void {
  console.log("知识库导入器：knowledge-import");
  console.log("");
  console.log(
    "用法: pnpm run knowledge-import -- run --source <literature_kb|wechat_style|presets|job_posts> [--input <路径>] [--collection <集合>] [--mode <replace-collection|append|upsert-by-source-id>] [--skip-verify] [--dry-run]",
  );
  console.log("");
  console.log("示例:");
  console.log(
    "  pnpm run knowledge-import -- run --source literature_kb --input side-tools/pdf-text-cleanup/out --collection literature --mode replace-collection",
  );
}

function parseCli(argv: string[]): KnowledgeImporterOptions {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [command, ...rest] = normalizedArgv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command !== "run") {
    throw new Error(`未知命令: ${command}`);
  }

  const source = rest.find((value, index) => rest[index - 1] === "--source");
  if (!source) {
    throw new Error("缺少必填参数: --source");
  }

  const input = rest.find((value, index) => rest[index - 1] === "--input");
  const collection = rest.find(
    (value, index) => rest[index - 1] === "--collection",
  );
  const mode = rest.find((value, index) => rest[index - 1] === "--mode");

  return {
    argv: normalizedArgv,
    cwd: process.cwd(),
    command: "run",
    source,
    input,
    collection,
    mode,
    skipVerify: rest.includes("--skip-verify"),
    dryRun: rest.includes("--dry-run"),
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const context = await runKnowledgeImporter(options);

  console.log(`知识库导入流程完成。source=${context.source}`);
  console.log(`已完成阶段: ${context.completedStages.join(" -> ")}`);
  if (context.normalizedDocumentCount != null) {
    console.log(`标准化文档数: ${context.normalizedDocumentCount}`);
  }
  if (context.chunkRecordCount != null) {
    console.log(`切块记录数: ${context.chunkRecordCount}`);
  }
  if (context.notes.length > 0) {
    console.log("备注:");
    context.notes.forEach((note) => console.log(`- ${note}`));
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
