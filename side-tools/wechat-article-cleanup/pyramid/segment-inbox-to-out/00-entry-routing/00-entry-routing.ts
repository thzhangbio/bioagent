import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { parseMarkdownFrontMatter } from "../../shared/markdown-frontmatter.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
  type WechatCleanupDraft,
} from "../stage-shared.js";

function readSingleRawRecord(inputFile: string) {
  const inboxPath = resolve(process.cwd(), inputFile);
  const rawHtml = readFileSync(inboxPath, "utf-8");
  const isMarkdown = /\.md$/i.test(inboxPath);
  const parsed = isMarkdown ? parseMarkdownFrontMatter(rawHtml) : null;
  const sourceUrl =
    parsed && typeof parsed.fields.url === "string" ?
      parsed.fields.url
    : rawHtml.match(/<!--\s*source:\s*([^\n]+)/)?.[1]?.trim();
  const fetchedAt =
    parsed && typeof parsed.fields.fetchedAt === "string" ?
      parsed.fields.fetchedAt
    : rawHtml.match(/fetchedAt:\s*([^\n]+)/)?.[1]?.trim();
  return [
    {
      inboxFileName: basename(inboxPath),
      inboxPath,
      sourceUrl,
      fetchedAt,
      rawHtml,
      contentFormat: isMarkdown ? "clean_markdown" : "raw_html",
    },
  ];
}

function readInboxRawRecords(inboxDirPath: string) {
  return readdirSync(inboxDirPath)
    .filter(
      (f) =>
        (f.endsWith(".raw.html") || f.endsWith(".raw.htm") || f.endsWith(".md")) &&
        f !== "README.md",
    )
    .sort()
    .map((fileName) => {
      const inboxPath = resolve(inboxDirPath, fileName);
      const rawHtml = readFileSync(inboxPath, "utf-8");
      const isMarkdown = /\.md$/i.test(fileName);
      const parsed = isMarkdown ? parseMarkdownFrontMatter(rawHtml) : null;
      const sourceUrl =
        parsed && typeof parsed.fields.url === "string" ?
          parsed.fields.url
        : rawHtml.match(/<!--\s*source:\s*([^\n]+)/)?.[1]?.trim();
      const fetchedAt =
        parsed && typeof parsed.fields.fetchedAt === "string" ?
          parsed.fields.fetchedAt
        : rawHtml.match(/fetchedAt:\s*([^\n]+)/)?.[1]?.trim();
      return {
        inboxFileName: fileName,
        inboxPath,
        sourceUrl,
        fetchedAt,
        rawHtml,
        contentFormat: isMarkdown ? "clean_markdown" : "raw_html",
      };
    });
}

export const segmentInboxToOut00EntryRoutingStage: SegmentInboxToOutStage = {
  name: "00-entry-routing",
  run(context) {
    const rawRecords =
      context.inputFile ?
        readSingleRawRecord(context.inputFile)
      : readInboxRawRecords(context.inboxDirPath);
    const drafts: WechatCleanupDraft[] = rawRecords.map((rawRecord) => ({
      rawRecord,
      inboxBaseName: rawRecord.inboxFileName.replace(/(\.raw\.html?|\.md)$/i, ""),
      meta: {},
      blocks: [],
    }));
    return appendSegmentInboxToOutNote(
      {
        ...context,
        rawRecords,
        drafts,
      },
      `00-entry-routing: loaded ${rawRecords.length} raw record(s).`,
    );
  },
};
