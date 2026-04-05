import { mkdirSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

export const segmentOutToArchive04InboxArchiveSidecarStage: SegmentOutToArchiveStage =
  {
    name: "04-inbox-archive-sidecar",
    run(context) {
      if (context.options.mode === "out-only") {
        return appendSegmentOutToArchiveNote(
          context,
          "04-inbox-archive-sidecar: skipped inbox move in out-only mode.",
        );
      }

      if (context.inboxTargets.length === 0) {
        return appendSegmentOutToArchiveNote(
          context,
          "04-inbox-archive-sidecar: no inbox source files to archive.",
        );
      }

      mkdirSync(context.inboxArchiveDest ?? "", { recursive: true });
      for (const file of context.inboxTargets) {
        renameSync(file, join(context.inboxArchiveDest ?? "", basename(file)));
      }
      return appendSegmentOutToArchiveNote(
        context,
        "04-inbox-archive-sidecar: archived inbox source files.",
      );
    },
  };

