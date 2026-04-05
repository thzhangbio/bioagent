import { join } from "node:path";

import { pdfArchiveStamp } from "../segment-out-to-archive.archive-stamp.js";
import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

export const segmentOutToArchive01TargetPathsStage: SegmentOutToArchiveStage = {
  name: "01-target-paths",
  run(context) {
    const stamp = pdfArchiveStamp();
    return appendSegmentOutToArchiveNote(
      {
        ...context,
        outArchiveDest: join(
          context.archiveDirPath ?? "",
          "ingested-out",
          stamp,
        ),
        inboxArchiveDest: join(
          context.archiveDirPath ?? "",
          "processed-mineru",
          stamp,
        ),
      },
      "01-target-paths: resolved archive destination folders.",
    );
  },
};

