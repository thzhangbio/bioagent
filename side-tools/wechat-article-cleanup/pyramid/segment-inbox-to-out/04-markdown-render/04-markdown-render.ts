import {
  parseMarkdownFrontMatter,
  renderMarkdownFrontMatter,
} from "../../shared/markdown-frontmatter.js";
import { renderWechatStyleExtractionSection } from "../segment-inbox-to-out.style-slots.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut04MarkdownRenderStage: SegmentInboxToOutStage = {
  name: "04-markdown-render",
  run(context) {
    const drafts = context.drafts.map((draft) => {
      const parsed = parseMarkdownFrontMatter(draft.outMarkdown ?? "");
      const extraction = draft.styleExtraction ?
        renderWechatStyleExtractionSection(draft.styleExtraction)
      : "## 风格提取\n\n> [风格·说明] （当前未生成风格槽位）";
      const body = [
        extraction,
        "",
        "## 原文正文（清洗版）",
        "",
        parsed.body.trim(),
      ].join("\n");
      const outMarkdown = renderMarkdownFrontMatter(
        {
          ...parsed.fields,
          wechat_style_slot_schema: "medsci-style-slots-v1",
          wechat_style_slot_extracted_at: new Date().toISOString(),
        },
        body,
      );
      return {
        ...draft,
        markdownBody: body,
        outMarkdown,
      };
    });
    return appendSegmentInboxToOutNote(
      {
        ...context,
        drafts,
      },
      `04-markdown-render: rendered ${drafts.length} style extraction markdown draft(s).`,
    );
  },
};
