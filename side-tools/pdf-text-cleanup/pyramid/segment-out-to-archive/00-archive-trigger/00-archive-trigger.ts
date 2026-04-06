import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  doiToFilenameSegment,
  extractDoiSegmentFromArchiveBasename,
  extractTimestampFromArchiveBasename,
} from "../../segment-inbox-to-out/segment-inbox-to-out.archive-name-shared.js";
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

interface ArchiveReadyManifestFile {
  fileName?: string;
  outPath?: string;
  doi?: string;
}

function listCurrentOutTargets(outDirPath: string): string[] {
  return readdirSync(outDirPath)
    .filter((file) => file.endsWith(".kb.md"))
    .sort()
    .map((file) => join(outDirPath, file));
}

function chooseNewestPath(paths: string[]): string | undefined {
  return [...paths].sort((left, right) => {
    const leftStamp = extractTimestampFromArchiveBasename(
      basename(left, ".kb.md"),
    ) ?? "";
    const rightStamp = extractTimestampFromArchiveBasename(
      basename(right, ".kb.md"),
    ) ?? "";
    return rightStamp.localeCompare(leftStamp);
  })[0];
}

function resolveManifestOutTargets(
  manifestFiles: ArchiveReadyManifestFile[],
  currentOutTargets: string[],
): { resolved: string[]; staleCount: number } {
  const currentByBasename = new Map(
    currentOutTargets.map((file) => [basename(file), file]),
  );
  const currentByDoi = new Map<string, string[]>();
  for (const file of currentOutTargets) {
    const doiSegment = extractDoiSegmentFromArchiveBasename(
      basename(file, ".kb.md"),
    );
    if (!doiSegment) continue;
    const bucket = currentByDoi.get(doiSegment) ?? [];
    bucket.push(file);
    currentByDoi.set(doiSegment, bucket);
  }

  const resolved = new Set<string>();
  let staleCount = 0;
  for (const file of manifestFiles) {
    const direct = file.outPath && existsSync(file.outPath) ? file.outPath : undefined;
    if (direct) {
      resolved.add(direct);
      continue;
    }

    const byName =
      file.fileName && currentByBasename.has(file.fileName)
        ? currentByBasename.get(file.fileName)
        : undefined;
    if (byName) {
      resolved.add(byName);
      continue;
    }

    const doiSegment =
      (file.doi ? doiToFilenameSegment(file.doi) : null) ??
      (file.outPath
        ? extractDoiSegmentFromArchiveBasename(
            basename(file.outPath, ".kb.md"),
          )
        : null);
    if (doiSegment) {
      const newest = chooseNewestPath(currentByDoi.get(doiSegment) ?? []);
      if (newest) {
        resolved.add(newest);
        continue;
      }
    }

    staleCount++;
  }

  return {
    resolved: [...resolved].sort(),
    staleCount,
  };
}

export const segmentOutToArchive00ArchiveTriggerStage: SegmentOutToArchiveStage =
  {
    name: "00-archive-trigger",
    run(context) {
      const argv = context.options.argv;
      const modeArg = argv.find((value, index) => argv[index - 1] === "--mode");
      const outSelectionArg = argv.find(
        (value, index) => argv[index - 1] === "--out-selection",
      );
      const mode =
        context.options.mode ??
        (modeArg === "all" || modeArg === "out-only" || modeArg === "inbox-only"
          ? modeArg
          : "all");
      const outSelection =
        context.options.outSelection ??
        (outSelectionArg === "manifest-first" || outSelectionArg === "current-only"
          ? outSelectionArg
          : "manifest-first");
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
      const currentOutTargets =
        mode === "inbox-only" ? [] : listCurrentOutTargets(outDirPath);
      if (existsSync(manifestPath) && outSelection !== "current-only") {
        manifestPayload = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          files?: ArchiveReadyManifestFile[];
        };
        const manifestResolved = resolveManifestOutTargets(
          manifestPayload.files ?? [],
          currentOutTargets,
        );
        outTargets = manifestResolved.resolved;
        if (manifestResolved.staleCount > 0) {
          context = appendSegmentOutToArchiveNote(
            context,
            `00-archive-trigger: skipped ${manifestResolved.staleCount} stale manifest entr${manifestResolved.staleCount === 1 ? "y" : "ies"}.`,
          );
        }
      } else if (mode !== "inbox-only") {
        outTargets = currentOutTargets;
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
            outSelection,
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
        `00-archive-trigger: resolved archive mode and source targets (out-selection=${outSelection}).`,
      );
    },
  };
