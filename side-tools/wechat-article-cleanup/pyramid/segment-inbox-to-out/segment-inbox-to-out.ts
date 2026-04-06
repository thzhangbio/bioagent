import { join, resolve } from "node:path";

import {
  appendWechatCleanupNote,
  type WechatCleanupStage,
} from "../stage-shared.js";
import {
  createSegmentInboxToOutContext,
  markSegmentInboxToOutStageComplete,
  type SegmentInboxToOutStage,
} from "./stage-shared.js";
import { segmentInboxToOut00EntryRoutingStage } from "./00-entry-routing/00-entry-routing.js";
import { segmentInboxToOut01SourceProfileStage } from "./01-source-profile/01-source-profile.js";
import { segmentInboxToOut02ArticleCategoryStage } from "./02-article-category/02-article-category.js";
import { segmentInboxToOut03StructureBlocksStage } from "./03-structure-blocks/03-structure-blocks.js";
import { segmentInboxToOut04MarkdownRenderStage } from "./04-markdown-render/04-markdown-render.js";
import { segmentInboxToOut05WriteFinalStage } from "./05-write-final/05-write-final.js";

function rootPath(cwd: string): string {
  return resolve(cwd, "side-tools/wechat-article-cleanup");
}

const segmentInboxToOutStages: SegmentInboxToOutStage[] = [
  segmentInboxToOut00EntryRoutingStage,
  segmentInboxToOut01SourceProfileStage,
  segmentInboxToOut02ArticleCategoryStage,
  segmentInboxToOut03StructureBlocksStage,
  segmentInboxToOut04MarkdownRenderStage,
  segmentInboxToOut05WriteFinalStage,
];

export const segmentInboxToOutStage: WechatCleanupStage = {
  name: "segment-inbox-to-out",
  async run(context) {
    if (context.options.fetchOnly && !context.options.inputFile) {
      return appendWechatCleanupNote(
        {
          ...context,
          outDirPath: join(rootPath(context.options.cwd), "out"),
        },
        "segment-inbox-to-out: skipped clean because fetch-only mode is enabled.",
      );
    }

    const root = rootPath(context.options.cwd);
    const inboxDirPath = join(root, "inbox");
    const outDirPath = join(root, "out");

    let segmentContext = createSegmentInboxToOutContext({
      cwd: context.options.cwd,
      rootDir: root,
      inboxDirPath,
      outDirPath,
      stripFooter: Boolean(context.options.stripFooter),
      fetchStats: Boolean(context.options.fetchStats),
      deferLiangyi: context.options.deferLiangyi !== false,
      inputFile: context.options.inputFile,
    });

    for (const stage of segmentInboxToOutStages) {
      segmentContext = await stage.run(segmentContext);
      segmentContext = markSegmentInboxToOutStageComplete(
        segmentContext,
        stage.name,
      );
    }

    const outRecords = segmentContext.drafts
      .filter((draft) => draft.outPath && draft.outBaseName && draft.sourceProfile && draft.articleCategory)
      .map((draft) => ({
        inboxPath: draft.rawRecord.inboxPath,
        outPath: draft.outPath!,
        outBaseName: draft.outBaseName!,
        sourceProfile: draft.sourceProfile!,
        articleCategory: draft.articleCategory!,
        title: draft.meta.title,
        mpName: draft.meta.mp_name,
      }));

    let next = appendWechatCleanupNote(
      {
        ...context,
        inboxDirPath,
        outDirPath,
        rawRecords: segmentContext.rawRecords,
        outRecords,
      },
      `segment-inbox-to-out: cleaned ${outRecords.length} article(s) into out/.`,
    );
    for (const note of segmentContext.notes) {
      next = appendWechatCleanupNote(next, note);
    }
    return next;
  },
};
