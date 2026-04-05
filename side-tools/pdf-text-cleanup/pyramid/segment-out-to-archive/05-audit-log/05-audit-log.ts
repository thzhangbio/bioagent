import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  appendSegmentOutToArchiveNote,
  type SegmentOutToArchiveStage,
} from "../stage-shared.js";

export const segmentOutToArchive05AuditLogStage: SegmentOutToArchiveStage = {
  name: "05-audit-log",
  run(context) {
    const auditDir = join(context.archiveDirPath ?? "", "audit-log");
    mkdirSync(auditDir, { recursive: true });
    const auditLogPath = join(
      auditDir,
      `${basename(context.outArchiveDest ?? context.inboxArchiveDest ?? "archive")}.json`,
    );
    const payload = {
      generatedAt: new Date().toISOString(),
      mode: context.options.mode,
      outArchiveDest: context.outArchiveDest,
      inboxArchiveDest: context.inboxArchiveDest,
      outTargets: context.outTargets,
      inboxTargets: context.inboxTargets,
      notes: context.notes,
    };
    writeFileSync(auditLogPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

    if (context.manifestPath && existsSync(context.manifestPath)) {
      rmSync(context.manifestPath);
    }

    return appendSegmentOutToArchiveNote(
      {
        ...context,
        auditLogPath,
      },
      "05-audit-log: wrote archive audit log and cleared ready manifest.",
    );
  },
};
