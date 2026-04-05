/**
 * 终版知识库流水线：
 * 原始 MinerU MD → {@link mineruRawMarkdownToPreliminary} →（可选 JSON 结构摘要）→ {@link cleanMarkdownForKnowledgeBase}
 *
 * 用法:
 *   pnpm exec tsx side-tools/pdf-text-cleanup/pipeline.ts --raw-md <原始.md> [--json <结构化.json>] [--out <输出.md>] [--also-simple-out] [--no-rename-inbox] [--no-crossref] [--no-europepmc]
 *
 * 未指定 `--out` 时：
 * - 写入 `out/{YYYYMMDDHHmm}+{slug}+{DOI下划线}.kb.md`；
 * - **同步**将 `inbox` 内本次使用的 `.md`（及若有的 `.json`）重命名为与上述文件**相同基名**（`…+slug+doi.md` / `.json`），避免与 out 归档名对不上；
 * - `--also-simple-out` 额外再写 `out/<更名前的源文件名>.kb.md`（默认关闭，减少 out 重复）；
 * - `--no-rename-inbox` 不改动 inbox 文件名。
 * 指定 `--out` 时只写该路径，且不触发 inbox 更名、不生成归档名。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanMarkdownForKnowledgeBase } from "./mineru-kb.js";
import {
  formatStructureSectionForKb,
  listMineruStructure,
} from "./mineru-json-structure.js";
import { mineruRawMarkdownToPreliminary } from "./raw-to-preliminary.js";
import {
  buildKbArchiveBasename,
  buildKbArchiveFilenamePartsFromKbMetadata,
} from "./kb-archive-filename.js";
import { prependNormalizedKbMetadata } from "./kb-metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): {
  rawMd: string;
  jsonPath?: string;
  out?: string;
  keepStructureManifest?: boolean;
  alsoSimpleOut?: boolean;
  noRenameInbox?: boolean;
  noCrossref?: boolean;
  noEuropepmc?: boolean;
} {
  const argv = process.argv.slice(2);
  let rawMd = "";
  let jsonPath: string | undefined;
  let out: string | undefined;
  let keepStructureManifest = false;
  let alsoSimpleOut = false;
  let noRenameInbox = false;
  let noCrossref = false;
  let noEuropepmc = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raw-md" && argv[i + 1]) rawMd = argv[++i];
    else if (a === "--json" && argv[i + 1]) jsonPath = argv[++i];
    else if (a === "--out" && argv[i + 1]) out = argv[++i];
    else if (a === "--keep-structure-manifest") keepStructureManifest = true;
    else if (a === "--also-simple-out") alsoSimpleOut = true;
    else if (a === "--no-rename-inbox") noRenameInbox = true;
    else if (a === "--no-crossref") noCrossref = true;
    else if (a === "--no-europepmc") noEuropepmc = true;
  }
  return {
    rawMd,
    jsonPath,
    out,
    keepStructureManifest,
    alsoSimpleOut,
    noRenameInbox,
    noCrossref,
    noEuropepmc,
  };
}

/**
 * 将 inbox 源稿重命名为与 `out/*.kb.md` 相同的基名（不含扩展名），便于与归档一一对应。
 */
function renameInboxSourcesToMatchArchiveKb(opts: {
  rawMdPath: string;
  jsonResolvedPath: string | undefined;
  archiveKbPath: string;
}): void {
  const archiveBase = basename(opts.archiveKbPath, ".kb.md");
  const mdDir = dirname(opts.rawMdPath);
  const targetMd = join(mdDir, `${archiveBase}.md`);
  const currentMdBase = basename(opts.rawMdPath, ".md");

  if (resolve(opts.rawMdPath) === resolve(targetMd)) {
    console.log(`inbox 源稿已是归档基名，跳过: ${archiveBase}.md`);
  } else {
    if (existsSync(targetMd)) unlinkSync(targetMd);
    renameSync(opts.rawMdPath, targetMd);
    console.log(`inbox 已更名: ${currentMdBase}.md → ${archiveBase}.md`);
  }

  if (!opts.jsonResolvedPath) return;
  const jsonDir = dirname(opts.jsonResolvedPath);
  const targetJson = join(jsonDir, `${archiveBase}.json`);
  const currentJsonBase = basename(opts.jsonResolvedPath, ".json");
  if (resolve(opts.jsonResolvedPath) === resolve(targetJson)) {
    console.log(`inbox JSON 已是归档基名，跳过: ${archiveBase}.json`);
    return;
  }
  if (existsSync(targetJson)) unlinkSync(targetJson);
  renameSync(opts.jsonResolvedPath, targetJson);
  console.log(`inbox 已更名: ${currentJsonBase}.json → ${archiveBase}.json`);
}

async function main(): Promise<void> {
  const {
    rawMd: rawArg,
    jsonPath,
    out: outArg,
    keepStructureManifest,
    alsoSimpleOut,
    noRenameInbox,
    noCrossref,
    noEuropepmc,
  } = parseArgs();
  if (!rawArg) {
    console.error(
      "用法: pnpm exec tsx side-tools/pdf-text-cleanup/pipeline.ts --raw-md <原始MinerU.md> [--json <同篇.json>] [--out <输出.md>] [--keep-structure-manifest] [--also-simple-out] [--no-rename-inbox] [--no-crossref] [--no-europepmc]",
    );
    process.exit(1);
  }

  const rawMdPath = resolve(process.cwd(), rawArg);
  const rawMineruMd = readFileSync(rawMdPath, "utf-8");
  let body = mineruRawMarkdownToPreliminary(rawMineruMd);

  let jsonResolvedPath: string | undefined;
  if (jsonPath) {
    jsonResolvedPath = resolve(process.cwd(), jsonPath);
    const jsonFull = jsonResolvedPath;
    const json = JSON.parse(readFileSync(jsonFull, "utf-8")) as unknown;
    const entries = listMineruStructure(json);
    body = formatStructureSectionForKb(entries) + body;
  }

  const cleanedBody = cleanMarkdownForKnowledgeBase(body, {
    stripMineruStructureManifest: !keepStructureManifest,
  });

  const baseForDoi = basename(rawArg, ".md");
  const finalMd = await prependNormalizedKbMetadata(cleanedBody, {
    fetchCrossref: !noCrossref,
    fetchEuropePmc: !noEuropepmc,
    doiFallbackFromBasename: baseForDoi,
  });

  const outDir = join(__dirname, "out");
  mkdirSync(outDir, { recursive: true });
  const base = basename(rawArg, ".md");

  let primaryOut: string;
  if (outArg) {
    primaryOut = resolve(process.cwd(), outArg);
  } else {
    const parts = buildKbArchiveFilenamePartsFromKbMetadata(finalMd, base);
    primaryOut = join(outDir, buildKbArchiveBasename(parts));
    console.log(
      `归档名: ${parts.timestamp} + ${parts.slug} + ${parts.doiSegment}`,
    );
  }

  writeFileSync(primaryOut, finalMd, "utf-8");
  console.log(`已写入: ${primaryOut}`);
  console.log(`约 ${finalMd.length} 字符`);

  if (alsoSimpleOut && !outArg) {
    const simplePath = join(outDir, `${base}.kb.md`);
    writeFileSync(simplePath, finalMd, "utf-8");
    console.log(`已写入（简名，便于固定路径）: ${simplePath}`);
  }

  if (!outArg && !noRenameInbox) {
    renameInboxSourcesToMatchArchiveKb({
      rawMdPath,
      jsonResolvedPath,
      archiveKbPath: primaryOut,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
