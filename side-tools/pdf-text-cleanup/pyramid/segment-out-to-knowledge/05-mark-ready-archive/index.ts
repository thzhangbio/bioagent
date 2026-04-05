import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

export const segmentOutToKnowledge05MarkReadyArchiveStage: SegmentOutToKnowledgeStage =
  {
    name: "05-mark-ready-archive",
    run(context) {
      const manifestPath = join(context.outDirPath ?? "", ".archive-ready.json");
      const payload = {
        generatedAt: new Date().toISOString(),
        outDirPath: context.outDirPath,
        knowledgeDirPath: context.knowledgeDirPath,
        ragStorePath: context.ragStorePath,
        files: context.copiedFiles.map((file) => ({
          fileName: file.fileName,
          outPath: file.outPath,
          knowledgePath: file.knowledgePath,
          doi: file.doi,
          slug: file.slug,
        })),
      };
      writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
      return appendSegmentOutToKnowledgeNote(
        {
          ...context,
          manifestPath,
        },
        "05-mark-ready-archive: wrote archive-ready manifest.",
      );
    },
  };

