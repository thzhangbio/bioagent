import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { renameInboxRawToOutBasename } from "../../shared/wechat-article-filename.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut05WriteFinalStage: SegmentInboxToOutStage = {
  name: "05-write-final",
  run(context) {
    mkdirSync(context.outDirPath, { recursive: true });
    const drafts = context.drafts.map((draft) => {
      const outPath = join(context.outDirPath, `${draft.outBaseName}.md`);
      writeFileSync(outPath, draft.outMarkdown ?? "", "utf-8");
      if (!context.inputFile) {
        renameInboxRawToOutBasename(
          draft.rawRecord.inboxPath,
          draft.inboxBaseName,
          draft.outBaseName ?? draft.inboxBaseName,
        );
      }
      return {
        ...draft,
        outPath,
      };
    });

    return appendSegmentInboxToOutNote(
      {
        ...context,
        drafts,
      },
      `05-write-final: wrote ${drafts.length} out file(s).`,
    );
  },
};
