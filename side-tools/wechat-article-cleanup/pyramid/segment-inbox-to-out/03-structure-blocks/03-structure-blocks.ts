import { fetchWechatEngagementStats } from "../../shared/appmsg-stats.js";
import {
  slugHintForKbWechat,
  wechatArticleBasename,
} from "../../shared/wechat-article-filename.js";
import { slugFromMpArticleUrl } from "../../shared/slug.js";
import {
  extractBlocksFromMarkdown,
  renderWechatMarkdownFromExistingMarkdown,
  renderWechatMarkdownFromRaw,
} from "../segment-inbox-to-out.structure.js";
import { extractWechatStyleSlots } from "../segment-inbox-to-out.style-slots.js";
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
      const outMarkdown =
        draft.rawRecord.contentFormat === "clean_markdown" ?
          renderWechatMarkdownFromExistingMarkdown(draft.rawRecord.rawHtml, {
            wechat_style_variant: draft.styleVariant,
            wechat_source_profile: draft.sourceProfile,
            wechat_article_category: draft.articleCategory,
            wechat_style_slot_schema: "medsci-style-slots-v1",
            wechat_style_slot_extracted_at: new Date().toISOString(),
          })
        : renderWechatMarkdownFromRaw(draft.rawRecord.rawHtml, {
            sourceUrl: draft.rawRecord.sourceUrl,
            slugHint,
            fetchedAt: draft.rawRecord.fetchedAt ?? new Date().toISOString(),
            stripFooterPatterns: context.stripFooter,
            engagement,
            styleVariant: draft.styleVariant,
            sourceProfile: draft.sourceProfile,
            articleCategory: draft.articleCategory,
          });
      const blocks = extractBlocksFromMarkdown(outMarkdown);
      drafts.push({
        ...draft,
        outBaseName,
        outMarkdown,
        blocks,
        styleExtraction: extractWechatStyleSlots({
          title: draft.meta.title,
          blocks,
        }),
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
