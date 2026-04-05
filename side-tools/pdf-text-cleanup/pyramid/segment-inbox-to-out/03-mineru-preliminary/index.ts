import { mineruRawMarkdownToPreliminary } from "../../../raw-to-preliminary.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut03MineruPreliminaryStage: SegmentInboxToOutStage =
  {
    name: "03-mineru-preliminary",
    run(context) {
      const preliminaryMd = mineruRawMarkdownToPreliminary(context.rawMdText ?? "");
      const workingBody = `${context.structureSection ?? ""}${preliminaryMd}`;
      return appendSegmentInboxToOutNote(
        {
          ...context,
          preliminaryMd,
          workingBody,
        },
        "03-mineru-preliminary: normalized raw MinerU markdown into preliminary body.",
      );
    },
  };
