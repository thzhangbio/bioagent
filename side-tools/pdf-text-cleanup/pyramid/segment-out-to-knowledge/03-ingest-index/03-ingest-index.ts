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

      const result = spawnSync("pnpm", ["run", "ingest:literature"], {
        cwd: context.options.cwd,
        stdio: "inherit",
        env: {
          ...process.env,
          LITERATURE_INBOX: context.knowledgeDirPath,
        },
      });
      if (result.status !== 0) {
        throw new Error(`ingest:literature 失败，退出码 ${result.status ?? "unknown"}`);
      }

      return appendSegmentOutToKnowledgeNote(
        context,
        "03-ingest-index: completed literature ingest.",
      );
    },
  };
