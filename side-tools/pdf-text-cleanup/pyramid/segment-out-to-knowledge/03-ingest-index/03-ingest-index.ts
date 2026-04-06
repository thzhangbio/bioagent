import { spawnSync } from "node:child_process";

import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

export const segmentOutToKnowledge03IngestIndexStage: SegmentOutToKnowledgeStage =
  {
    name: "03-ingest-index",
    run(context) {
      if (context.options.skipIngest) {
        return appendSegmentOutToKnowledgeNote(
          context,
          "03-ingest-index: skipped ingest by option.",
        );
      }

      const result = spawnSync(
        "pnpm",
        [
          "run",
          "knowledge-import",
          "--",
          "run",
          "--source",
          "literature_kb",
          "--input",
          context.knowledgeDirPath ?? "",
          "--collection",
          "literature",
          "--mode",
          "upsert-by-source-id",
        ],
        {
        cwd: context.options.cwd,
        stdio: "inherit",
        },
      );
      if (result.status !== 0) {
        throw new Error(`knowledge-import literature_kb 失败，退出码 ${result.status ?? "unknown"}`);
      }

      return appendSegmentOutToKnowledgeNote(
        context,
        "03-ingest-index: completed literature ingest.",
      );
    },
  };
