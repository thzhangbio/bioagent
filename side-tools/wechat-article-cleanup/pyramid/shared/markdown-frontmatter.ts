import { yamlDoubleQuotedScalar } from "./wechat-meta.js";

export interface ParsedMarkdownFrontMatter {
  fields: Record<string, string | boolean | number>;
  body: string;
}

function parseScalar(raw: string): string | boolean | number {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const quoted = value.match(/^"(.*)"$/);
  if (quoted) {
    return quoted[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return value;
}

export function parseMarkdownFrontMatter(
  markdown: string,
): ParsedMarkdownFrontMatter {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      fields: {},
      body: markdown.trim(),
    };
  }

  const yaml = match[1] ?? "";
  const body = markdown.slice(match[0].length).trim();
  const fields: Record<string, string | boolean | number> = {};

  for (const line of yaml.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (!kv) continue;
    fields[kv[1]!] = parseScalar(kv[2]!);
  }

  return { fields, body };
}

function renderScalar(value: string | boolean | number): string {
  if (typeof value === "string") return yamlDoubleQuotedScalar(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function renderMarkdownFrontMatter(
  fields: Record<string, string | boolean | number | undefined>,
  body: string,
): string {
  const preferredOrder = [
    "source",
    "kb_wechat_id",
    "url",
    "fetchedAt",
    "title",
    "is_original",
    "editor",
    "mp_name",
    "wechat_style_variant",
    "wechat_source_profile",
    "wechat_article_category",
    "wechat_style_source",
    "wechat_style_genre",
    "wechat_style_task",
    "wechat_style_slot_schema",
    "wechat_style_slot_extracted_at",
    "published_at",
    "published_at_cn",
    "stats_read",
    "stats_old_like",
    "stats_like",
    "stats_share",
    "stats_comment",
    "stats_collect",
    "stats_fetched_at",
    "stats_fetch_error",
  ];

  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const ordered = [
    ...preferredOrder
      .map((key) => [key, fields[key]] as const)
      .filter(([, value]) => value !== undefined),
    ...entries.filter(([key]) => !preferredOrder.includes(key)),
  ];

  const yamlLines = ordered.map(([key, value]) => `${key}: ${renderScalar(value!)}`);
  return ["---", ...yamlLines, "---", "", body.trim()].join("\n");
}
