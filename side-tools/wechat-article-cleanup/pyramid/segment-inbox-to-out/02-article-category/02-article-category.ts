import { detectWechatArticleCategory } from "../segment-inbox-to-out.article-category.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut02ArticleCategoryStage: SegmentInboxToOutStage = {
  name: "02-article-category",
  run(context) {
    const drafts = context.drafts.map((draft) => ({
      ...draft,
      articleCategory: detectWechatArticleCategory(
        draft.meta.title,
        draft.rawRecord.rawHtml,
      ),
    }));
    return appendSegmentInboxToOutNote(
      {
        ...context,
        drafts,
      },
      `02-article-category: classified ${drafts.length} draft(s).`,
    );
  },
};
