import { existsSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut12InboxSyncStage: SegmentInboxToOutStage = {
  name: "12-inbox-sync",
  run(context) {
    if (context.options.out || context.options.noRenameInbox) {
      return appendSegmentInboxToOutNote(
        context,
        "12-inbox-sync: skipped inbox rename due to explicit output or no-rename option.",
      );
    }

    if (!context.rawMdPath || !context.primaryOutPath) {
      return appendSegmentInboxToOutNote(
        context,
        "12-inbox-sync: skipped because required paths were unavailable.",
      );
    }

    const archiveBase = basename(context.primaryOutPath, ".kb.md");
    const renamedInboxPaths = [...context.renamedInboxPaths];

    const targetMd = join(dirname(context.rawMdPath), `${archiveBase}.md`);
    if (resolve(context.rawMdPath) !== resolve(targetMd)) {
      if (existsSync(targetMd)) unlinkSync(targetMd);
      renameSync(context.rawMdPath, targetMd);
      renamedInboxPaths.push(targetMd);
    }

    if (context.jsonPath) {
      const targetJson = join(dirname(context.jsonPath), `${archiveBase}.json`);
      if (resolve(context.jsonPath) !== resolve(targetJson)) {
        if (existsSync(targetJson)) unlinkSync(targetJson);
        renameSync(context.jsonPath, targetJson);
        renamedInboxPaths.push(targetJson);
      }
    }

    return appendSegmentInboxToOutNote(
      {
        ...context,
        renamedInboxPaths,
      },
      "12-inbox-sync: aligned inbox source names with archive basename.",
    );
  },
};
