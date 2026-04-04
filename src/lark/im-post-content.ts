/**
 * 飞书 IM「富文本」消息（msg_type: post）的 content 结构。
 * @see https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/im-v1/message/create_json
 */

const POST_CONTENT_MAX = 28_000;

export type PostTextElement = {
  tag: "text";
  text: string;
  style?: ("bold" | "italic" | "underline" | "lineThrough")[];
};

export type PostLinkElement = {
  tag: "a";
  text: string;
  href: string;
};

export type PostElement = PostTextElement | PostLinkElement;

function parseInlineSegments(line: string): PostElement[] {
  const out: PostElement[] = [];
  const re = /(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      out.push(...parseBoldOnly(line.slice(last, m.index)));
    }
    const full = m[0]!;
    const linkInner = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkInner) {
      out.push({ tag: "a", text: linkInner[1]!, href: linkInner[2]! });
    } else {
      out.push(...parseBoldOnly(full));
    }
    last = m.index + full.length;
  }
  if (last < line.length) {
    out.push(...parseBoldOnly(line.slice(last)));
  }
  return out.length > 0 ? out : [{ tag: "text", text: line }];
}

function parseBoldOnly(s: string): PostElement[] {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  const out: PostElement[] = [];
  for (const p of parts) {
    if (!p) continue;
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) out.push({ tag: "text", text: m[1]!, style: ["bold"] });
    else out.push({ tag: "text", text: p });
  }
  return out;
}

/**
 * 将助手侧 Markdown 风格正文转为飞书 `post` 消息的 `content` 字段值（已是 JSON 字符串）。
 * 支持：`##`/`###` 行（显示为加粗）、`**粗体**`、`[文字](url)`、段落与空行。
 */
export function buildImPostContentString(markdownLike: string): string {
  const normalized = markdownLike.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return JSON.stringify({
      zh_cn: { title: "", content: [[{ tag: "text", text: "（空）" }]] },
    });
  }

  const lines = normalized.split("\n");
  const content: PostElement[][] = [];

  for (const line of lines) {
    if (line.trim() === "") continue;

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      content.push([
        { tag: "text", text: h[2]!.trim(), style: ["bold"] },
      ]);
      continue;
    }

    const bullet = line.match(/^(\s*[-*]|\s*\d+\.)\s+(.+)$/);
    if (bullet) {
      const inner = bullet[2]!;
      const row: PostElement[] = [{ tag: "text", text: "• " }];
      row.push(...parseInlineSegments(inner));
      content.push(row);
      continue;
    }

    content.push(parseInlineSegments(line));
  }

  if (content.length === 0) {
    content.push([{ tag: "text", text: normalized.slice(0, 5000) }]);
  }

  const payload = { zh_cn: { title: "", content } };
  let str = JSON.stringify(payload);
  if (str.length > POST_CONTENT_MAX) {
    const fallback = {
      zh_cn: {
        title: "",
        content: [
          [{ tag: "text" as const, text: normalized.slice(0, 12_000) }],
        ],
      },
    };
    str = JSON.stringify(fallback);
  }
  return str;
}
