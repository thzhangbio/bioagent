import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

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
      const copiedFiles = context.outFiles.map((file) => {
        const knowledgePath = join(context.knowledgeDirPath ?? "", file.fileName);
        copyFileSync(file.outPath, knowledgePath);
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
        "01-copy-to-knowledge: copied kb markdown files into literature inbox.",
      );
    },
  };

