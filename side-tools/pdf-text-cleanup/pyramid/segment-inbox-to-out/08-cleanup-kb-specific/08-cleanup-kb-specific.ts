import {
  applyKbSpecificPreCleanup,
} from "../segment-inbox-to-out.kb-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut08CleanupKbSpecificStage: SegmentInboxToOutStage =
  {
    name: "08-cleanup-kb-specific",
    run(context) {
      const workingBody = applyKbSpecificPreCleanup(context.workingBody ?? "", {
        stripMineruStructureManifest: context.options.keepStructureManifest,
      });
      return appendSegmentInboxToOutNote(
        {
          ...context,
          workingBody,
        },
        "08-cleanup-kb-specific: applied KB-specific pre-cleanup.",
      );
    },
  };
