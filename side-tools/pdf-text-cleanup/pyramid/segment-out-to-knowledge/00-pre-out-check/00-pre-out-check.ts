import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractPrimaryDoiFromMarkdown,
  slugFromKbMarkdown,
} from "../../segment-inbox-to-out/segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeFileRecord,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEGMENT_ROOT = dirname(__dirname);
const DEFAULT_OUT_DIR = join(SEGMENT_ROOT, "..", "..", "out");
const DEFAULT_KNOWLEDGE_DIR = join(
  SEGMENT_ROOT,
  "..",
  "..",
  "..",
  "..",
  "data",
  "knowledge",
  "literature-inbox",
);

export const segmentOutToKnowledge00PreOutCheckStage: SegmentOutToKnowledgeStage =
  {
    name: "00-pre-out-check",
    run(context) {
      const argv = context.options.argv;
      const outDirArg = argv.find((value, index) => argv[index - 1] === "--out-dir");
      const knowledgeDirArg = argv.find(
        (value, index) => argv[index - 1] === "--knowledge-dir",
      );
      const skipCopy = argv.includes("--skip-copy");
      const skipIngest = argv.includes("--skip-ingest");

      const outDirPath = resolve(
        context.options.cwd,
        context.options.outDir ?? outDirArg ?? DEFAULT_OUT_DIR,
      );
      const knowledgeDirPath = resolve(
        context.options.cwd,
        context.options.knowledgeDir ?? knowledgeDirArg ?? DEFAULT_KNOWLEDGE_DIR,
      );

      if (!existsSync(outDirPath)) {
        throw new Error(`out 目录不存在: ${outDirPath}`);
      }

      const scannedFiles: SegmentOutToKnowledgeFileRecord[] = readdirSync(outDirPath)
        .filter((file) => file.endsWith(".kb.md"))
        .sort()
        .map((fileName) => {
          const outPath = join(outDirPath, fileName);
          const raw = readFileSync(outPath, "utf-8");
          return {
            fileName,
            outPath,
            doi: extractPrimaryDoiFromMarkdown(raw),
            slug: slugFromKbMarkdown(raw, fileName),
          };
        });

      const dedupedByIdentity = new Map<string, SegmentOutToKnowledgeFileRecord>();
      for (const file of scannedFiles) {
        const identity = file.doi || file.slug || file.fileName;
        dedupedByIdentity.set(identity, file);
      }
      const outFiles = [...dedupedByIdentity.values()].sort((a, b) =>
        a.fileName.localeCompare(b.fileName),
      );

      if (outFiles.length === 0) {
        throw new Error(`out/ 下无可入库的 .kb.md: ${outDirPath}`);
      }

      return appendSegmentOutToKnowledgeNote(
        {
          ...context,
          options: {
            ...context.options,
            outDir: outDirPath,
            knowledgeDir: knowledgeDirPath,
            skipCopy,
            skipIngest,
          },
          outDirPath,
          knowledgeDirPath,
          outFiles,
        },
        "00-pre-out-check: collected out/*.kb.md candidates.",
      );
    },
  };
