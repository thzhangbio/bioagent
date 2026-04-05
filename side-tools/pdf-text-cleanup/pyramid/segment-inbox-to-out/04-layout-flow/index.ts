import {
  applyPdfLayoutFlowCleanup,
  type CleanupOptions,
} from "../../../cleanup.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut04LayoutFlowStage: SegmentInboxToOutStage = {
  name: "04-layout-flow",
  run(context) {
    const cleanupOptions: CleanupOptions = {
      joinParagraphsWithBlankLine: true,
    };
    return appendSegmentInboxToOutNote(
      {
        ...context,
        workingBody: applyPdfLayoutFlowCleanup(
          context.workingBody ?? "",
          cleanupOptions,
        ),
      },
      "04-layout-flow: applied paragraph flow and soft-break cleanup.",
    );
  },
};
