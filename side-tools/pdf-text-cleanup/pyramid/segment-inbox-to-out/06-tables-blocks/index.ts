import { flattenHtmlTablesToPlain } from "../../../mineru-kb.js";
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
