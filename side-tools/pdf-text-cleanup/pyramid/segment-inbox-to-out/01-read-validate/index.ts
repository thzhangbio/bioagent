import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut01ReadValidateStage: SegmentInboxToOutStage = {
  name: "01-read-validate",
  run(context) {
    const rawMdPath = resolve(context.options.cwd, context.options.rawMd ?? "");
    const rawMdText = readFileSync(rawMdPath, "utf-8");
    let jsonPath: string | undefined;
    let rawJson: unknown;
    if (context.options.jsonPath) {
      jsonPath = resolve(context.options.cwd, context.options.jsonPath);
      rawJson = JSON.parse(readFileSync(jsonPath, "utf-8")) as unknown;
    }

    return appendSegmentInboxToOutNote(
      {
        ...context,
        rawMdPath,
        rawMdText,
        jsonPath,
        rawJson,
      },
      "01-read-validate: loaded source markdown and optional json.",
    );
  },
};
