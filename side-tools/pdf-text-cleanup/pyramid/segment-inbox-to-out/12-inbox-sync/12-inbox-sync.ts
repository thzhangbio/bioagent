import { existsSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  extractDoiSegmentFromArchiveBasename,
  extractTimestampFromArchiveBasename,
} from "../segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

function pruneOlderInboxDuplicates(dirPath: string, currentTargetMd: string): number {
  const currentBase = basename(currentTargetMd, ".md");
  const doiSegment = extractDoiSegmentFromArchiveBasename(currentBase);
  const currentTimestamp = extractTimestampFromArchiveBasename(currentBase);
  if (!doiSegment || !currentTimestamp) return 0;

  let removed = 0;
  const peers = readdirSync(dirPath).filter(
    (file) =>
      file.endsWith(".md") &&
      file !== basename(currentTargetMd) &&
      file !== "README.md" &&
      !file.startsWith("MinerU_markdown_") &&
      extractDoiSegmentFromArchiveBasename(basename(file, ".md")) === doiSegment,
  );

  for (const file of peers) {
    const peerBase = basename(file, ".md");
    const peerTimestamp = extractTimestampFromArchiveBasename(peerBase);
    if (!peerTimestamp || peerTimestamp <= currentTimestamp) {
      unlinkSync(join(dirPath, file));
      removed += 1;
    }
  }

  return removed;
}

export const segmentInboxToOut12InboxSyncStage: SegmentInboxToOutStage = {
  name: "13-inbox-sync",
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
    const removedInboxDuplicates = pruneOlderInboxDuplicates(dirname(targetMd), targetMd);

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
      removedInboxDuplicates > 0 ?
        `12-inbox-sync: aligned inbox source names with archive basename and pruned ${removedInboxDuplicates} older inbox duplicate(s).`
      : "12-inbox-sync: aligned inbox source names with archive basename.",
    );
  },
};
