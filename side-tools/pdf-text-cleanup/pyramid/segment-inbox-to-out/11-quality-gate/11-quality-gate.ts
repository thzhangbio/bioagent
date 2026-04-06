import { KB_SHORT_INLINE_MATH_MAX_INNER_LEN } from "../segment-inbox-to-out.kb-shared.js";
import { scanMarkdownForUnresolvedInlineFragments } from "../09-formula-fragments/fragment-audit-shared.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

const MAX_EXAMPLES = 8;

export const segmentInboxToOut11QualityGateStage: SegmentInboxToOutStage = {
  name: "11-quality-gate",
  run(context) {
    const finalMd = context.finalMd ?? "";
    const unresolved = scanMarkdownForUnresolvedInlineFragments(
      finalMd,
      KB_SHORT_INLINE_MATH_MAX_INNER_LEN,
    );
    if (unresolved.length > 0) {
      const examples = unresolved
        .slice(0, MAX_EXAMPLES)
        .map((item) => `line ${item.line}: ${item.fragment}`)
        .join("\n");
      throw new Error(
        [
          "段Ⅰ质量门未通过：仍存在未解析的 LaTeX 短碎片，禁止写出 out/*.kb.md。",
          `未解析总出现: ${unresolved.length}`,
          `示例:\n${examples}`,
          "请先补公式碎片规则、更新 fixtures，并重新运行 pdf-kb-pipeline。",
        ].join("\n"),
      );
    }

    return appendSegmentInboxToOutNote(
      context,
      "11-quality-gate: passed unresolved LaTeX fragment gate (0 unresolved).",
    );
  },
};
