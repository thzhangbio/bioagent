import { existsSync } from "node:fs";
import { basename, join } from "node:path";

import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

export const segmentOutToArchive02IdempotencyStage: SegmentOutToArchiveStage = {
  name: "02-idempotency",
  run(context) {
    for (const file of context.outTargets) {
      const target = join(context.outArchiveDest ?? "", basename(file));
      if (existsSync(target)) {
        throw new Error(`目标文件已存在，拒绝覆盖: ${target}`);
      }
    }
    for (const file of context.inboxTargets) {
      const target = join(context.inboxArchiveDest ?? "", basename(file));
      if (existsSync(target)) {
        throw new Error(`目标文件已存在，拒绝覆盖: ${target}`);
      }
    }
    return appendSegmentOutToArchiveNote(
      context,
      "02-idempotency: destination paths are conflict-free.",
    );
  },
};

