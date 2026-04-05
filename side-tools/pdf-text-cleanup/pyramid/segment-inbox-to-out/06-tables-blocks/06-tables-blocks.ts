import { flattenHtmlTablesToPlain } from "../segment-inbox-to-out.kb-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut06TablesBlocksStage: SegmentInboxToOutStage = {
  name: "06-tables-blocks",
  run(context) {
    return appendSegmentInboxToOutNote(
      {
        ...context,
        workingBody: flattenHtmlTablesToPlain(context.workingBody ?? ""),
      },
      "06-tables-blocks: flattened table-like blocks into plain text.",
    );
  },
};
