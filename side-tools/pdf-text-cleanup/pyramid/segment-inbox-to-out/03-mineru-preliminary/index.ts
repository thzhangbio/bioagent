import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut03MineruPreliminaryStage: SegmentInboxToOutStage =
  {
    name: "03-mineru-preliminary",
    run(context) {
      return appendSegmentInboxToOutNote(
        context,
        "03-mineru-preliminary: root stage placeholder created.",
      );
    },
  };

