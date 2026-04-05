import { applyPdfGenericCleanup } from "../../../cleanup.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut07CleanupGenericStage: SegmentInboxToOutStage = {
  name: "07-cleanup-generic",
  run(context) {
    return appendSegmentInboxToOutNote(
      {
        ...context,
        workingBody: applyPdfGenericCleanup(context.workingBody ?? ""),
      },
      "07-cleanup-generic: applied generic OCR and latex cleanup.",
    );
  },
};
