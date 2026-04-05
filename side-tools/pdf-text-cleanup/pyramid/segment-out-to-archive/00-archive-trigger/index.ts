import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveContext,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEGMENT_ROOT = dirname(__dirname);
const DEFAULT_OUT_DIR = join(SEGMENT_ROOT, "..", "..", "out");
const DEFAULT_INBOX_DIR = join(SEGMENT_ROOT, "..", "..", "inbox");
const DEFAULT_ARCHIVE_DIR = join(SEGMENT_ROOT, "..", "..", "archive");

export const segmentOutToArchive00ArchiveTriggerStage: SegmentOutToArchiveStage =
  {
    name: "00-archive-trigger",
    run(context) {
      const argv = context.options.argv;
      const modeArg = argv.find((value, index) => argv[index - 1] === "--mode");
      const mode =
        context.options.mode ??
        (modeArg === "all" || modeArg === "out-only" || modeArg === "inbox-only"
          ? modeArg
          : "all");
      const force = context.options.force ?? argv.includes("--force");
      const outDirArg = argv.find((value, index) => argv[index - 1] === "--out-dir");
      const inboxDirArg = argv.find((value, index) => argv[index - 1] === "--inbox-dir");
      const archiveDirArg = argv.find((value, index) => argv[index - 1] === "--archive-dir");
      const outDirPath = resolve(
        context.options.cwd,
        context.options.outDir ?? outDirArg ?? DEFAULT_OUT_DIR,
      );
      const inboxDirPath = resolve(
        context.options.cwd,
        context.options.inboxDir ?? inboxDirArg ?? DEFAULT_INBOX_DIR,
      );
      const archiveDirPath = resolve(
        context.options.cwd,
        context.options.archiveDir ?? archiveDirArg ?? DEFAULT_ARCHIVE_DIR,
      );
      const manifestPath = join(outDirPath, ".archive-ready.json");

      let manifestPayload: SegmentOutToArchiveContext["manifestPayload"];
      let outTargets: string[] = [];
      if (existsSync(manifestPath)) {
        manifestPayload = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          files?: Array<{ outPath?: string }>;
        };
        outTargets = (manifestPayload.files ?? [])
          .map((file) => file.outPath)
          .filter((value): value is string => Boolean(value));
      } else if (mode !== "inbox-only") {
        outTargets = readdirSync(outDirPath)
          .filter((file) => file.endsWith(".kb.md"))
          .sort()
          .map((file) => join(outDirPath, file));
      }

      const inboxTargets = existsSync(inboxDirPath)
        ? readdirSync(inboxDirPath)
            .filter(
              (file) =>
                (file.endsWith(".md") || file.endsWith(".json")) &&
                file !== "README.md",
            )
            .sort()
            .map((file) => join(inboxDirPath, file))
        : [];

      if (mode !== "inbox-only" && outTargets.length === 0 && !force) {
        throw new Error("未找到可归档的 out/*.kb.md，也未发现 archive-ready manifest。");
      }

      return appendSegmentOutToArchiveNote(
        {
          ...context,
          options: {
            ...context.options,
            mode,
            force,
            outDir: outDirPath,
            inboxDir: inboxDirPath,
            archiveDir: archiveDirPath,
          },
          outDirPath,
          inboxDirPath,
          archiveDirPath,
          outTargets,
          inboxTargets,
          manifestPath: existsSync(manifestPath) ? manifestPath : undefined,
          manifestPayload,
        },
        "00-archive-trigger: resolved archive mode and source targets.",
      );
    },
  };
