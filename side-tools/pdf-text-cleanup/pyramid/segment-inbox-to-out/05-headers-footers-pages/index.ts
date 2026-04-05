import { applyPdfHeadersFootersPagesCleanup } from "../../../cleanup.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut05HeadersFootersPagesStage: SegmentInboxToOutStage =
  {
    name: "05-headers-footers-pages",
    run(context) {
      return appendSegmentInboxToOutNote(
        {
          ...context,
          workingBody: applyPdfHeadersFootersPagesCleanup(
            context.workingBody ?? "",
          ),
        },
        "05-headers-footers-pages: removed page noise and repeated headers/footers.",
      );
    },
  };
