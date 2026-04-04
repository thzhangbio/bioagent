/**
 * 将 `side-tools/wechat-article-cleanup/out/` 下已清洗的公众号 Markdown 切块嵌入，
 * 写入统一向量库中的 **wechat_style（表达层）** 集合；块级带 **`wechatStyleVariant`**、**`wechatContentSlot`**。
 *
 * 用法: pnpm run ingest:wechat
 *
 * 环境变量:
 *   WECHAT_STYLE_INBOX — 可选，覆盖默认 out 目录（相对仓库根或绝对路径）
 *   WECHAT_DEFAULT_VARIANT — 可选，当文件无 YAML/meta 时的子风格，默认 `medsci`
 *
 * 可选侧车：`{同名}.meta.json`（与 `.md` 同目录同基名）
 *   { "wechatStyleVariant": "medsci" }
 *
 * YAML：优先读文内 **`wechat_style_variant`**；**`kb_wechat_id`** 用于块追溯（清洗器已写入）。
 *
 * 会**替换**库内全部 `wechat_style` 块，不影响 literature / platform_tone 等。
 */
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLLECTION_WECHAT_STYLE } from "../src/knowledge/collections.js";
import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import {
  buildMergedStore,
  embedTextChunks,
} from "../src/knowledge/ingest.js";
import { DEFAULT_RAG_STORE_PATH, PROJECT_ROOT } from "../src/knowledge/paths.js";
import type { TextChunk, WechatStyleVariant } from "../src/knowledge/types.js";
import {
  idSafeKbWechatId,
  sanitizeWechatFileKey,
  segmentsToChunkTexts,
  segmentWechatBody,
  splitMarkdownFrontMatter,
} from "../src/knowledge/wechat-segments.js";
import { saveVectorStore } from "../src/knowledge/vector-file-store.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT_ROOT = join(__dirname, "..");

const VALID_VARIANTS = new Set<WechatStyleVariant>(["medsci", "liangyi_hui"]);

interface WechatSideMeta {
  wechatStyleVariant?: WechatStyleVariant;
}

function defaultInbox(): string {
  const fromEnv = process.env.WECHAT_STYLE_INBOX?.trim();
  if (fromEnv) return join(SCRIPT_ROOT, fromEnv);
  return join(
    PROJECT_ROOT,
    "side-tools",
    "wechat-article-cleanup",
    "out",
  );
}

function loadSideMeta(inbox: string, baseName: string): WechatSideMeta | null {
  const metaPath = join(inbox, `${baseName}.meta.json`);
  if (!existsSync(metaPath)) return null;
  try {
    const raw = readFileSync(metaPath, "utf-8");
    return JSON.parse(raw) as WechatSideMeta;
  } catch {
    return null;
  }
}

function resolveVariant(
  sideMeta: WechatSideMeta | null,
  front: Record<string, string>,
): WechatStyleVariant {
  const fromSide = sideMeta?.wechatStyleVariant;
  if (fromSide && VALID_VARIANTS.has(fromSide)) return fromSide;

  const fromYaml = front.wechat_style_variant?.trim();
  if (fromYaml && VALID_VARIANTS.has(fromYaml as WechatStyleVariant)) {
    return fromYaml as WechatStyleVariant;
  }

  const env = process.env.WECHAT_DEFAULT_VARIANT?.trim();
  if (env && VALID_VARIANTS.has(env as WechatStyleVariant)) {
    return env as WechatStyleVariant;
  }

  return "medsci";
}

async function main(): Promise<void> {
  const inbox = defaultInbox();
  if (!existsSync(inbox)) {
    mkdirSync(inbox, { recursive: true });
    console.warn(`已创建空目录: ${inbox}（请放入清洗后的 .md 后再执行）`);
  }

  const files = existsSync(inbox)
    ? readdirSync(inbox).filter(
        (f) =>
          f.endsWith(".md") &&
          f.toUpperCase() !== "README.MD" &&
          !f.startsWith("."),
      )
    : [];

  if (files.length === 0) {
    console.error(`未在目录中找到可灌库的 .md 文件: ${inbox}`);
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const textChunks: TextChunk[] = [];

  for (const file of files.sort()) {
    const abs = join(inbox, file);
    const raw = readFileSync(abs, "utf-8");
    const base = basename(file, ".md");
    const sideMeta = loadSideMeta(inbox, base);
    const { front, body } = splitMarkdownFrontMatter(raw);
    const variant = resolveVariant(sideMeta, front);
    const kbRaw =
      front.kb_wechat_id?.trim() || `mp1|s|${sanitizeWechatFileKey(base)}`;
    const kbWechatId = kbRaw.replace(/^"|"$/g, "");
    const sourceLabel =
      front.title?.replace(/^"|"$/g, "").trim() || base.slice(0, 120);
    const sourcePath = abs.replace(PROJECT_ROOT + "/", "");
    const idPrefix = idSafeKbWechatId(kbWechatId);
    const fileKey = sanitizeWechatFileKey(base);

    const segments = segmentWechatBody(body);
    const flat = segmentsToChunkTexts(segments);

    flat.forEach(({ slot, text }, chunkIndex) => {
      textChunks.push({
        id: `wcs__${idPrefix}__${fileKey}__${slot}__c${chunkIndex}`,
        collection: COLLECTION_WECHAT_STYLE,
        sourcePath,
        sourceLabel,
        text,
        chunkIndex,
        wechatStyleVariant: variant,
        wechatContentSlot: slot,
        kbWechatId,
      });
    });

    console.log(
      `  ${file} → ${flat.length} 块 (${variant}; kb=${kbWechatId.slice(0, 48)}…)`,
    );
  }

  console.log(
    `微信成稿 ${files.length} 个，向量块 ${textChunks.length} 条 → 合并入 ${DEFAULT_RAG_STORE_PATH}（仅替换 wechat_style）`,
  );

  const stored = await embedTextChunks(client, textChunks);
  const store = buildMergedStore([COLLECTION_WECHAT_STYLE], stored);

  mkdirSync(join(PROJECT_ROOT, "data", "knowledge"), { recursive: true });
  saveVectorStore(DEFAULT_RAG_STORE_PATH, store);
  console.log(`已写入，总块数 ${store.chunks.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
