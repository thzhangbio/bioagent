import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createWechatCleanupContext,
  appendWechatCleanupNote,
  type WechatCleanupStage,
} from "../stage-shared.js";

export const segmentOutToKnowledgeStage: WechatCleanupStage = {
  name: "segment-out-to-knowledge",
  run(context) {
    if (
      context.options.fetchOnly ||
      context.options.inputFile ||
      context.options.skipKnowledge
    ) {
      return appendWechatCleanupNote(
        context,
        "segment-out-to-knowledge: skipped by mode or option.",
      );
    }

    const outDir = context.outDirPath ?? resolve(context.options.cwd, "side-tools/wechat-article-cleanup/out");
    const outFiles = readdirSync(outDir).filter(
      (file) => file.endsWith(".md") && file !== "README.md",
    );

    if (outFiles.length === 0) {
      return appendWechatCleanupNote(
        context,
        "segment-out-to-knowledge: skipped because out/ has no markdown files.",
      );
    }

    const result = spawnSync(
      "pnpm",
      [
        "run",
        "knowledge-import",
        "--",
        "run",
        "--source",
        "wechat_style",
        "--input",
        outDir,
        "--collection",
        "wechat_style",
        "--mode",
        "replace-collection",
      ],
      {
        cwd: context.options.cwd,
        stdio: "inherit",
        env: process.env,
      },
    );

    if (result.status !== 0) {
      throw new Error(`knowledge-import wechat_style 失败，退出码 ${result.status ?? "unknown"}`);
    }

    return appendWechatCleanupNote(
      context,
      `segment-out-to-knowledge: imported ${outFiles.length} out file(s) into wechat_style.`,
    );
  },
};

async function main(): Promise<void> {
  const context = await segmentOutToKnowledgeStage.run(
    createWechatCleanupContext({
      argv: process.argv.slice(2),
      cwd: process.cwd(),
      skipKnowledge: false,
      skipArchive: true,
      fetchOnly: false,
      cleanOnly: false,
    }),
  );
  for (const note of context.notes) {
    console.log(note);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
