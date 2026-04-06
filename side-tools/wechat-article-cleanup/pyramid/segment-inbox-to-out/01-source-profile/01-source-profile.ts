import { extractWechatArticleMeta } from "../../shared/wechat-meta.js";
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
        const meta = extractWechatArticleMeta(draft.rawRecord.rawHtml);
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
