import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildKbArchiveBasename } from "../segment-inbox-to-out.archive-name-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEGMENT_ROOT = dirname(__dirname);

export const segmentInboxToOut11WriteFinalStage: SegmentInboxToOutStage = {
  name: "11-write-final",
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
      "11-write-final: wrote final KB markdown output.",
    );
  },
};
