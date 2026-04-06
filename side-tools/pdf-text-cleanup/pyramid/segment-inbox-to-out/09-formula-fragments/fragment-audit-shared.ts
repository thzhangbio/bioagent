import {
  KB_SHORT_INLINE_MATH_MAX_INNER_LEN,
  normalizeMineruInlineLatex,
} from "../segment-inbox-to-out.kb-shared.js";

export interface UnresolvedInlineFragmentMatch {
  fragment: string;
  line: number;
}

export function shortDollarRegex(maxInner: number): RegExp {
  return new RegExp(
    `(?<!\\$)\\$(?!\\$)([^$\\n]{1,${maxInner}})\\$(?!\\$)`,
    "g",
  );
}

export function scanMarkdownForUnresolvedInlineFragments(
  text: string,
  maxInner = KB_SHORT_INLINE_MATH_MAX_INNER_LEN,
): UnresolvedInlineFragmentMatch[] {
  const lines = text.split(/\n/);
  const unresolved: UnresolvedInlineFragmentMatch[] = [];

  lines.forEach((line, lineIdx) => {
    const re = new RegExp(shortDollarRegex(maxInner).source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const fragment = match[0]!;
      if (normalizeMineruInlineLatex(fragment) === fragment) {
        unresolved.push({
          fragment,
          line: lineIdx + 1,
        });
      }
    }
  });

  return unresolved;
}
