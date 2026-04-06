import { extractWechatArticleMeta } from "../../shared/wechat-meta.js";
import { parseMarkdownFrontMatter } from "../../shared/markdown-frontmatter.js";
import {
  detectWechatSourceProfile,
  inferWechatStyleVariantFromProfile,
} from "../segment-inbox-to-out.source-profile.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut01SourceProfileStage: SegmentInboxToOutStage = {
  name: "01-source-profile",
  run(context) {
    const drafts = context.drafts
      .map((draft) => {
        const meta =
          draft.rawRecord.contentFormat === "clean_markdown" ?
            (() => {
              const parsed = parseMarkdownFrontMatter(draft.rawRecord.rawHtml);
              return {
                title:
                  typeof parsed.fields.title === "string" ? parsed.fields.title : undefined,
                is_original:
                  typeof parsed.fields.is_original === "boolean" ?
                    parsed.fields.is_original
                  : undefined,
                editor:
                  typeof parsed.fields.editor === "string" ?
                    parsed.fields.editor
                  : undefined,
                mp_name:
                  typeof parsed.fields.mp_name === "string" ?
                    parsed.fields.mp_name
                  : undefined,
                published_at:
                  typeof parsed.fields.published_at === "string" ?
                    parsed.fields.published_at
                  : undefined,
                published_at_cn:
                  typeof parsed.fields.published_at_cn === "string" ?
                    parsed.fields.published_at_cn
                  : undefined,
              };
            })()
          : extractWechatArticleMeta(draft.rawRecord.rawHtml);
        const sourceProfile = detectWechatSourceProfile(meta);
        if (context.deferLiangyi && sourceProfile === "liangyi_hui") {
          return null;
        }
        return {
          ...draft,
          meta,
          sourceProfile,
          styleVariant: inferWechatStyleVariantFromProfile(sourceProfile),
        };
      })
      .filter(Boolean);

    return appendSegmentInboxToOutNote(
      {
        ...context,
        drafts,
      },
      `01-source-profile: resolved source profile for ${drafts.length} draft(s).`,
    );
  },
};
