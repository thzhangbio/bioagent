/**
 * 终版知识库流水线：
 * 原始 MinerU MD → {@link mineruRawMarkdownToPreliminary} →（可选 JSON 结构摘要）→ {@link cleanMarkdownForKnowledgeBase}
 *
 * 用法:
 *   pnpm exec tsx side-tools/pdf-text-cleanup/pipeline.ts --raw-md <原始.md> [--json <结构化.json>] [--out <输出.md>]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanMarkdownForKnowledgeBase } from "./mineru-kb.js";
import {
  formatStructureSectionForKb,
  listMineruStructure,
} from "./mineru-json-structure.js";
import { mineruRawMarkdownToPreliminary } from "./raw-to-preliminary.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): {
  rawMd: string;
  jsonPath?: string;
  out?: string;
  keepStructureManifest?: boolean;
} {
  const argv = process.argv.slice(2);
  let rawMd = "";
  let jsonPath: string | undefined;
  let out: string | undefined;
  let keepStructureManifest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raw-md" && argv[i + 1]) rawMd = argv[++i];
    else if (a === "--json" && argv[i + 1]) jsonPath = argv[++i];
    else if (a === "--out" && argv[i + 1]) out = argv[++i];
    else if (a === "--keep-structure-manifest") keepStructureManifest = true;
  }
  return { rawMd, jsonPath, out, keepStructureManifest };
}

function main(): void {
  const { rawMd: rawArg, jsonPath, out: outArg, keepStructureManifest } =
    parseArgs();
  if (!rawArg) {
    console.error(
      "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pipeline.ts --raw-md <原始MinerU.md> [--json <同篇.json>] [--out <输出.md>] [--keep-structure-manifest]",
    );
    process.exit(1);
  }

  const rawMdPath = resolve(process.cwd(), rawArg);
  const rawMineruMd = readFileSync(rawMdPath, "utf-8");
  let body = mineruRawMarkdownToPreliminary(rawMineruMd);

  if (jsonPath) {
    const jsonFull = resolve(process.cwd(), jsonPath);
    const json = JSON.parse(readFileSync(jsonFull, "utf-8")) as unknown;
    const entries = listMineruStructure(json);
    body = formatStructureSectionForKb(entries) + body;
  }

  const finalMd = cleanMarkdownForKnowledgeBase(body, {
    stripMineruStructureManifest: !keepStructureManifest,
  });

  const outDir = join(__dirname, "out");
  mkdirSync(outDir, { recursive: true });
  const base = basename(rawArg, ".md");
  const outPath = outArg
    ? resolve(process.cwd(), outArg)
    : join(outDir, `${base}.kb.md`);

  writeFileSync(outPath, finalMd, "utf-8");
  console.log(`已写入: ${outPath}`);
  console.log(`约 ${finalMd.length} 字符`);
}

main();
