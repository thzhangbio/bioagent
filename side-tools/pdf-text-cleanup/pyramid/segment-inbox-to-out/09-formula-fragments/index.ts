import {
  applyKbSpecificPostCleanup,
  normalizeKbResidualDollarMath,
  normalizeMineruInlineLatex,
} from "../../../mineru-kb.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut09FormulaFragmentsStage: SegmentInboxToOutStage =
  {
    name: "09-formula-fragments",
    run(context) {
      const normalized = normalizeMineruInlineLatex(context.workingBody ?? "");
      const cleanedBody = applyKbSpecificPostCleanup(
        normalizeKbResidualDollarMath(normalized),
        {
          applyKbOcrTypoFixes: true,
          collapseImageBlocks: true,
          maxImagesPerRun: 1,
        },
      );
      return appendSegmentInboxToOutNote(
        {
          ...context,
          workingBody: cleanedBody,
          cleanedBody,
        },
        "09-formula-fragments: normalized inline formula fragments.",
      );
    },
  };
