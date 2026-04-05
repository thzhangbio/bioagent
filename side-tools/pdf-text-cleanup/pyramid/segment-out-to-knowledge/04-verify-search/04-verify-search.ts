import { existsSync, readFileSync } from "node:fs";

import {
  DEFAULT_RAG_STORE_PATH,
  PROJECT_ROOT,
} from "../../../../../src/knowledge/paths.js";
import {
  appendSegmentOutToKnowledgeNote,
  type SegmentOutToKnowledgeStage,
} from "../stage-shared.js";

interface RagStoreLike {
  chunks?: Array<{ sourcePath?: string }>;
}

export const segmentOutToKnowledge04VerifySearchStage: SegmentOutToKnowledgeStage =
  {
    name: "04-verify-search",
    run(context) {
      if (context.options.skipIngest) {
        return appendSegmentOutToKnowledgeNote(
          {
            ...context,
            ragStorePath: DEFAULT_RAG_STORE_PATH,
          },
          "04-verify-search: skipped rag verification because ingest was skipped.",
        );
      }

      if (!existsSync(DEFAULT_RAG_STORE_PATH)) {
        throw new Error(`未找到 rag store: ${DEFAULT_RAG_STORE_PATH}`);
      }

      const store = JSON.parse(
        readFileSync(DEFAULT_RAG_STORE_PATH, "utf-8"),
      ) as RagStoreLike;
      const sourcePaths = new Set(store.chunks?.map((chunk) => chunk.sourcePath).filter(Boolean));
      for (const file of context.copiedFiles) {
        const knowledgePath = file.knowledgePath ?? file.outPath;
        const relativePath = knowledgePath.startsWith(`${PROJECT_ROOT}/`)
          ? knowledgePath.replace(`${PROJECT_ROOT}/`, "")
          : knowledgePath;
        if (!sourcePaths.has(relativePath) && !sourcePaths.has(knowledgePath)) {
          throw new Error(`未在 rag store 中验证到文件: ${relativePath}`);
        }
      }

      return appendSegmentOutToKnowledgeNote(
        {
          ...context,
          ragStorePath: DEFAULT_RAG_STORE_PATH,
        },
        "04-verify-search: verified copied files inside rag store.",
      );
    },
  };
