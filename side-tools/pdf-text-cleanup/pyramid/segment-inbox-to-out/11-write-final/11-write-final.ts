import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildKbArchiveBasename,
  extractDoiSegmentFromArchiveBasename,
  extractTimestampFromArchiveBasename,
} from "../segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEGMENT_ROOT = dirname(__dirname);

function pruneOlderOutDuplicates(outDirPath: string, primaryOutPath: string): number {
  const primaryName = basename(primaryOutPath, ".kb.md");
  const doiSegment = extractDoiSegmentFromArchiveBasename(primaryName);
  const primaryTimestamp = extractTimestampFromArchiveBasename(primaryName);
  if (!doiSegment || !primaryTimestamp) return 0;

  let removed = 0;
  const candidates = readdirSync(outDirPath).filter(
    (file) =>
      file.endsWith(".kb.md") &&
      file !== basename(primaryOutPath) &&
      extractDoiSegmentFromArchiveBasename(basename(file, ".kb.md")) === doiSegment,
  );

  for (const file of candidates) {
    const candidateBase = basename(file, ".kb.md");
    const candidateTimestamp = extractTimestampFromArchiveBasename(candidateBase);
    if (!candidateTimestamp || candidateTimestamp <= primaryTimestamp) {
      unlinkSync(join(outDirPath, file));
      removed += 1;
    }
  }

  return removed;
}

export const segmentInboxToOut11WriteFinalStage: SegmentInboxToOutStage = {
  name: "12-write-final",
  run(context) {
    const outDirPath = join(SEGMENT_ROOT, "..", "..", "out");
    mkdirSync(outDirPath, { recursive: true });

    let primaryOutPath: string;
    if (context.options.out) {
      primaryOutPath = resolve(context.options.cwd, context.options.out);
    } else {
      primaryOutPath = join(
        outDirPath,
        buildKbArchiveBasename(
          context.archiveNameParts ?? {
            timestamp: "unknown",
            slug: "article",
            doiSegment: "no-doi",
          },
        ),
      );
    }

    writeFileSync(primaryOutPath, context.finalMd ?? "", "utf-8");
    const removedOutDuplicates =
      context.options.out ? 0 : pruneOlderOutDuplicates(outDirPath, primaryOutPath);

    let simpleOutPath: string | undefined;
    if (context.options.alsoSimpleOut && !context.options.out && context.options.rawMd) {
      const simpleBase = basename(context.options.rawMd, ".md");
      simpleOutPath = join(outDirPath, `${simpleBase}.kb.md`);
      writeFileSync(simpleOutPath, context.finalMd ?? "", "utf-8");
    }

    return appendSegmentInboxToOutNote(
      {
        ...context,
        outDirPath,
        primaryOutPath,
        simpleOutPath,
      },
      removedOutDuplicates > 0 ?
        `11-write-final: wrote final KB markdown output and pruned ${removedOutDuplicates} older out duplicate(s).`
      : "11-write-final: wrote final KB markdown output.",
    );
  },
};
