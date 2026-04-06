import { fetchWechatEngagementStats } from "../../shared/appmsg-stats.js";
import {
  slugHintForKbWechat,
  wechatArticleBasename,
} from "../../shared/wechat-article-filename.js";
import { slugFromMpArticleUrl } from "../../shared/slug.js";
import {
  extractBlocksFromMarkdown,
  renderWechatMarkdownFromRaw,
} from "../segment-inbox-to-out.structure.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut03StructureBlocksStage: SegmentInboxToOutStage = {
  name: "03-structure-blocks",
  async run(context) {
    const drafts = [];
    for (const draft of context.drafts) {
      const urlSlug = draft.rawRecord.sourceUrl ?
          slugFromMpArticleUrl(draft.rawRecord.sourceUrl)
        : null;
      const outBaseName = wechatArticleBasename(
        draft.meta.mp_name,
        draft.meta.title,
        urlSlug ?? draft.inboxBaseName,
      );
      const slugHint = slugHintForKbWechat(
        draft.rawRecord.rawHtml,
        draft.inboxBaseName,
      );
      const engagement =
        context.fetchStats ?
          await fetchWechatEngagementStats(draft.rawRecord.rawHtml, {
            sourceUrl: draft.rawRecord.sourceUrl,
            cookie: process.env.WECHAT_MP_COOKIE,
          })
        : undefined;
      const outMarkdown = renderWechatMarkdownFromRaw(draft.rawRecord.rawHtml, {
        sourceUrl: draft.rawRecord.sourceUrl,
        slugHint,
        fetchedAt: draft.rawRecord.fetchedAt ?? new Date().toISOString(),
        stripFooterPatterns: context.stripFooter,
        engagement,
        styleVariant: draft.styleVariant,
        sourceProfile: draft.sourceProfile,
        articleCategory: draft.articleCategory,
      });
      drafts.push({
        ...draft,
        outBaseName,
        outMarkdown,
        blocks: extractBlocksFromMarkdown(outMarkdown),
      });
    }

    return appendSegmentInboxToOutNote(
      {
        ...context,
        drafts,
      },
      `03-structure-blocks: built structure blocks for ${drafts.length} draft(s).`,
    );
  },
};
