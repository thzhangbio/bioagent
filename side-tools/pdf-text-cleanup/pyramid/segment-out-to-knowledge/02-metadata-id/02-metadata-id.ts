import { readFileSync } from "node:fs";

import {
  extractPrimaryDoiFromMarkdown,
  slugFromKbMarkdown,
} from "../../segment-inbox-to-out/segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

export const segmentOutToKnowledge02MetadataIdStage: SegmentOutToKnowledgeStage =
  {
    name: "02-metadata-id",
    run(context) {
      const normalized = context.copiedFiles.map((file) => {
        const raw = readFileSync(file.knowledgePath ?? file.outPath, "utf-8");
        return {
          ...file,
          doi: extractPrimaryDoiFromMarkdown(raw),
          slug: slugFromKbMarkdown(raw, file.fileName),
        };
      });
      return appendSegmentOutToKnowledgeNote(
        {
          ...context,
          copiedFiles: normalized,
        },
        "02-metadata-id: verified DOI/slug metadata for copied files.",
      );
    },
  };

