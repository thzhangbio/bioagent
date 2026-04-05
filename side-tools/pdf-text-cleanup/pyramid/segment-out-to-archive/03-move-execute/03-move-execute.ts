import { mkdirSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

export const segmentOutToArchive03MoveExecuteStage: SegmentOutToArchiveStage = {
  name: "03-move-execute",
  run(context) {
    if (context.options.mode === "inbox-only") {
      return appendSegmentOutToArchiveNote(
        context,
        "03-move-execute: skipped out move in inbox-only mode.",
      );
    }

    mkdirSync(context.outArchiveDest ?? "", { recursive: true });
    for (const file of context.outTargets) {
      renameSync(file, join(context.outArchiveDest ?? "", basename(file)));
    }
    return appendSegmentOutToArchiveNote(
      context,
      "03-move-execute: archived out targets.",
    );
  },
};

