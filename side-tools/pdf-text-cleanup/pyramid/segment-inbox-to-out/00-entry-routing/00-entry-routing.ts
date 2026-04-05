import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut00EntryRoutingStage: SegmentInboxToOutStage = {
  name: "00-entry-routing",
  run(context) {
    const argv = context.options.argv;
    const next = { ...context, options: { ...context.options } };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--raw-md" && argv[i + 1]) next.options.rawMd = argv[++i];
      else if (a === "--json" && argv[i + 1]) next.options.jsonPath = argv[++i];
      else if (a === "--out" && argv[i + 1]) next.options.out = argv[++i];
      else if (a === "--keep-structure-manifest") {
        next.options.keepStructureManifest = true;
      } else if (a === "--also-simple-out") {
        next.options.alsoSimpleOut = true;
      } else if (a === "--no-rename-inbox") {
        next.options.noRenameInbox = true;
      } else if (a === "--no-crossref") {
        next.options.noCrossref = true;
      } else if (a === "--no-europepmc") {
        next.options.noEuropepmc = true;
      }
    }

    if (!next.options.rawMd) {
      throw new Error(
        "用法: --raw-md <原始MinerU.md> [--json <同篇.json>] [--out <输出.md>] [--keep-structure-manifest] [--also-simple-out] [--no-rename-inbox] [--no-crossref] [--no-europepmc]",
      );
    }

    return appendSegmentInboxToOutNote(next, "00-entry-routing: parsed CLI options.");
  },
};
