import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { fetchWeChatArticleRaw } from "../shared/fetch.js";
import { appendLiangyiDeferred } from "../shared/liangyi-deferred.js";
import { parseLinksFile } from "../shared/parse-links.js";
import { slugFromMpArticleUrl } from "../shared/slug.js";
import {
  renameInboxRawToOutBasename,
  wechatArticleBasename,
} from "../shared/wechat-article-filename.js";
import {
  extractWechatArticleMeta,
  isLiangyiHuiAccount,
} from "../shared/wechat-meta.js";
import {
  appendWechatCleanupNote,
  type WechatCleanupStage,
} from "../stage-shared.js";

function rootPath(cwd: string): string {
  return resolve(cwd, "side-tools/wechat-article-cleanup");
}

export const segmentLinksToInboxStage: WechatCleanupStage = {
  name: "segment-links-to-inbox",
  async run(context) {
    if (context.options.cleanOnly || context.options.inputFile) {
      return appendWechatCleanupNote(
        {
          ...context,
          linksPath: join(rootPath(context.options.cwd), "links.txt"),
          inboxDirPath: join(rootPath(context.options.cwd), "inbox"),
        },
        "segment-links-to-inbox: skipped fetch because clean-only or single-file mode is enabled.",
      );
    }

    const root = rootPath(context.options.cwd);
    const linksPath = join(root, "links.txt");
    const inboxDirPath = join(root, "inbox");
    mkdirSync(inboxDirPath, { recursive: true });

    if (!existsSync(linksPath)) {
      throw new Error(`缺少 ${linksPath}`);
    }

    const links = parseLinksFile(readFileSync(linksPath, "utf-8"));
    let fetchedCount = 0;
    for (const url of links) {
      const urlSlug = slugFromMpArticleUrl(url);
      if (!urlSlug) continue;
      const result = await fetchWeChatArticleRaw(url);
      const meta = extractWechatArticleMeta(result.body);
      if (context.options.deferLiangyi !== false && isLiangyiHuiAccount(meta.mp_name)) {
        appendLiangyiDeferred(root, url, meta.mp_name ?? "良医汇");
        continue;
      }
      const base = wechatArticleBasename(meta.mp_name, meta.title, urlSlug);
      const inboxPath = join(inboxDirPath, `${base}.raw.html`);
      const header = `<!-- source: ${url}\n     fetchedAt: ${new Date().toISOString()}\n     httpStatus: ${result.status}\n     contentType: ${result.contentType}\n-->\n`;
      writeFileSync(inboxPath, header + result.body, "utf-8");
      renameInboxRawToOutBasename(inboxPath, base, base);
      fetchedCount += 1;
    }

    return appendWechatCleanupNote(
      {
        ...context,
        linksPath,
        inboxDirPath,
      },
      `segment-links-to-inbox: fetched ${fetchedCount} raw file(s).`,
    );
  },
};
