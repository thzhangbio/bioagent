import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { wechatArchiveStamp } from "../shared/archive-stamp.js";
import {
  createWechatCleanupContext,
  appendWechatCleanupNote,
  type WechatCleanupStage,
} from "../stage-shared.js";

function archiveInbox(root: string): string | null {
  const inbox = join(root, "inbox");
  const files = readdirSync(inbox).filter(
    (f) => (f.endsWith(".raw.html") || f.endsWith(".raw.htm")) && !f.startsWith("."),
  );
  if (files.length === 0) return null;
  const dest = join(root, "archive", "processed-inbox", wechatArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of files) {
    renameSync(join(inbox, f), join(dest, f));
  }
  return dest;
}

function archiveOut(root: string): string | null {
  const out = join(root, "out");
  const files = readdirSync(out).filter((f) => f.endsWith(".md") && f !== "README.md");
  if (files.length === 0) return null;
  const dest = join(root, "archive", "ingested-out", wechatArchiveStamp());
  mkdirSync(dest, { recursive: true });
  for (const f of files) {
    renameSync(join(out, f), join(dest, f));
  }
  return dest;
}

export const segmentOutToArchiveStage: WechatCleanupStage = {
  name: "segment-out-to-archive",
  run(context) {
    if (context.options.inputFile || context.options.skipArchive) {
      return appendWechatCleanupNote(
        context,
        "segment-out-to-archive: skipped by single-file mode or option.",
      );
    }

    const root = resolve(context.options.cwd, "side-tools/wechat-article-cleanup");
    const notes: string[] = [];

    if (!context.options.fetchOnly && !context.options.outOnlyArchive) {
      const inboxDest = archiveInbox(root);
      if (inboxDest) {
        notes.push(`segment-out-to-archive: archived inbox -> ${basename(inboxDest)}.`);
      }
    }

    if (!context.options.cleanOnly && context.options.inboxOnlyArchive) {
      let next = context;
      for (const note of notes) {
        next = appendWechatCleanupNote(next, note);
      }
      return next;
    }

    if (!context.options.fetchOnly) {
      const outDest = archiveOut(root);
      if (outDest) {
        notes.push(`segment-out-to-archive: archived out -> ${basename(outDest)}.`);
      }
    }

    let next = context;
    for (const note of notes) {
      next = appendWechatCleanupNote(next, note);
    }
    return next;
  },
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const mode = argv.find((value, index) => argv[index - 1] === "--mode") ?? "all";
  const context = await segmentOutToArchiveStage.run(
    createWechatCleanupContext({
      argv,
      cwd: process.cwd(),
      skipKnowledge: true,
      skipArchive: false,
      inboxOnlyArchive: mode === "inbox-only",
      outOnlyArchive: mode === "out-only",
      fetchOnly: false,
      cleanOnly: false,
    }),
  );
  for (const note of context.notes) {
    console.log(note);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
