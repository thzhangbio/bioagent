import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { KB_SHORT_INLINE_MATH_MAX_INNER_LEN } from "../../segment-inbox-to-out/segment-inbox-to-out.kb-shared.js";
import {
  extractPrimaryDoiFromMarkdown,
  slugFromKbMarkdown,
} from "../../segment-inbox-to-out/segment-inbox-to-out.archive-name-shared.js";
import { scanMarkdownForUnresolvedInlineFragments } from "../../segment-inbox-to-out/09-formula-fragments/fragment-audit-shared.js";
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
          const unresolved = scanMarkdownForUnresolvedInlineFragments(
            raw,
            KB_SHORT_INLINE_MATH_MAX_INNER_LEN,
          );
          if (unresolved.length > 0) {
            const examples = unresolved
              .slice(0, 5)
              .map((item) => `line ${item.line}: ${item.fragment}`)
              .join("\n");
            throw new Error(
              [
                `入库前质量门未通过：${fileName} 仍存在未解析 LaTeX 短碎片，禁止入库。`,
                `未解析总出现: ${unresolved.length}`,
                `示例:\n${examples}`,
                "请先运行碎片审计、补规则并重新生成高质量 out 稿。",
              ].join("\n"),
            );
          }
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
