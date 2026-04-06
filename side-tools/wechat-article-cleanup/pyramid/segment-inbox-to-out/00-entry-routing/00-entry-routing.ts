import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
  type WechatCleanupDraft,
} from "../stage-shared.js";

function readSingleRawRecord(inputFile: string) {
  const inboxPath = resolve(process.cwd(), inputFile);
  const rawHtml = readFileSync(inboxPath, "utf-8");
  const sourceUrl = rawHtml.match(/<!--\s*source:\s*([^\n]+)/)?.[1]?.trim();
  const fetchedAt = rawHtml.match(/fetchedAt:\s*([^\n]+)/)?.[1]?.trim();
  return [
    {
      inboxFileName: basename(inboxPath),
      inboxPath,
      sourceUrl,
      fetchedAt,
      rawHtml,
    },
  ];
}

function readInboxRawRecords(inboxDirPath: string) {
  return readdirSync(inboxDirPath)
    .filter((f) => f.endsWith(".raw.html") || f.endsWith(".raw.htm"))
    .sort()
    .map((fileName) => {
      const inboxPath = resolve(inboxDirPath, fileName);
      const rawHtml = readFileSync(inboxPath, "utf-8");
      const sourceUrl = rawHtml.match(/<!--\s*source:\s*([^\n]+)/)?.[1]?.trim();
      const fetchedAt = rawHtml.match(/fetchedAt:\s*([^\n]+)/)?.[1]?.trim();
      return {
        inboxFileName: fileName,
        inboxPath,
        sourceUrl,
        fetchedAt,
        rawHtml,
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
      inboxBaseName: rawRecord.inboxFileName.replace(/\.raw\.html?$/i, ""),
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
