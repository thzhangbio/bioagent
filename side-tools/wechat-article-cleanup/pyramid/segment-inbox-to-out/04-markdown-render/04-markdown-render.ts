import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut04MarkdownRenderStage: SegmentInboxToOutStage = {
  name: "04-markdown-render",
  run(context) {
    return appendSegmentInboxToOutNote(
      context,
      `04-markdown-render: rendered ${context.drafts.length} markdown draft(s).`,
    );
  },
};
