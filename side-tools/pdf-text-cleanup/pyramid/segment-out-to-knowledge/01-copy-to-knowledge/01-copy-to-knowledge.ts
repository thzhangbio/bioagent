import { copyFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";

import {
  extractDoiSegmentFromArchiveBasename,
  extractTimestampFromArchiveBasename,
} from "../../segment-inbox-to-out/segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

function pruneOlderKnowledgeDuplicates(knowledgeDirPath: string, knowledgePath: string): number {
  const currentBase = basename(knowledgePath, ".kb.md");
  const doiSegment = extractDoiSegmentFromArchiveBasename(currentBase);
  const currentTimestamp = extractTimestampFromArchiveBasename(currentBase);
  if (!doiSegment || !currentTimestamp) return 0;

  let removed = 0;
  for (const file of readdirSync(knowledgeDirPath)) {
    if (!file.endsWith(".kb.md") || file === basename(knowledgePath)) continue;
    const fileBase = basename(file, ".kb.md");
    if (extractDoiSegmentFromArchiveBasename(fileBase) !== doiSegment) continue;
    const ts = extractTimestampFromArchiveBasename(fileBase);
    if (!ts || ts <= currentTimestamp) {
      unlinkSync(join(knowledgeDirPath, file));
      removed += 1;
    }
  }
  return removed;
}

export const segmentOutToKnowledge01CopyToKnowledgeStage: SegmentOutToKnowledgeStage =
  {
    name: "01-copy-to-knowledge",
    run(context) {
      if (context.options.skipCopy) {
        return appendSegmentOutToKnowledgeNote(
          {
            ...context,
            copiedFiles: context.outFiles.map((file) => ({
              ...file,
              knowledgePath: join(context.knowledgeDirPath ?? "", file.fileName),
            })),
          },
          "01-copy-to-knowledge: skipped file copy by option.",
        );
      }

      mkdirSync(context.knowledgeDirPath ?? "", { recursive: true });
      let removedDuplicates = 0;
      const copiedFiles = context.outFiles.map((file) => {
        const knowledgePath = join(context.knowledgeDirPath ?? "", file.fileName);
        copyFileSync(file.outPath, knowledgePath);
        removedDuplicates += pruneOlderKnowledgeDuplicates(context.knowledgeDirPath ?? "", knowledgePath);
        return {
          ...file,
          knowledgePath,
        };
      });

      return appendSegmentOutToKnowledgeNote(
        {
          ...context,
          copiedFiles,
        },
        removedDuplicates > 0 ?
          `01-copy-to-knowledge: copied kb markdown files into literature inbox and pruned ${removedDuplicates} older knowledge duplicate(s).`
        : "01-copy-to-knowledge: copied kb markdown files into literature inbox.",
      );
    },
  };
