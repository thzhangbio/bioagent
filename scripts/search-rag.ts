/**
 * 在统一向量库 `data/knowledge/rag-store.json` 中检索。
 * 用法:
 *   pnpm run search:rag -- "你的查询"
 *   pnpm run search:rag -- "查询" --only platform_tone,medical
 *   pnpm run search:rag -- "导流话术" --only wechat_style --wechat-variants medsci --wechat-slots diversion
 */
import "dotenv/config";
import { existsSync } from "node:fs";

import { createEmbeddingClient } from "../src/knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../src/knowledge/paths.js";
import { retrieve } from "../src/knowledge/retrieve.js";
import type {
  KnowledgeCollection,
  WechatContentSlot,
  WechatStyleVariant,
} from "../src/knowledge/types.js";

const VALID: KnowledgeCollection[] = [
  "job_post",
  "platform_tone",
  "medical",
  "literature",
  "personal",
  "wechat_style",
];

const VALID_SLOTS: WechatContentSlot[] = [
  "body",
  "caption",
  "diversion",
  "references",
  "byline",
  "footer",
];

const VALID_WX_VARIANTS: WechatStyleVariant[] = ["medsci", "liangyi_hui"];

function parseArgs(): {
  query: string;
  collections?: KnowledgeCollection[];
  wechatStyleVariants?: WechatStyleVariant[];
  wechatContentSlots?: WechatContentSlot[];
} {
  const raw = process.argv.slice(2);
  const parts: string[] = [];
  let collections: KnowledgeCollection[] | undefined;
  let wechatStyleVariants: WechatStyleVariant[] | undefined;
  let wechatContentSlots: WechatContentSlot[] | undefined;

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!;
    if (a === "--only") {
      const list = raw[++i];
      if (!list) {
        console.error("--only 需要逗号分隔集合名，如: job_post,medical");
        process.exit(1);
      }
      collections = list.split(",").map((s) => s.trim()) as KnowledgeCollection[];
      for (const c of collections) {
        if (!VALID.includes(c)) {
          console.error(`未知集合: ${c}，可选: ${VALID.join(", ")}`);
          process.exit(1);
        }
      }
      continue;
    }
    if (a === "--wechat-variants") {
      const list = raw[++i];
      if (!list) {
        console.error("--wechat-variants 需要逗号分隔，如: medsci");
        process.exit(1);
      }
      wechatStyleVariants = list.split(",").map((s) => s.trim()) as WechatStyleVariant[];
      for (const v of wechatStyleVariants) {
        if (!VALID_WX_VARIANTS.includes(v)) {
          console.error(`未知 wechat 子风格: ${v}，可选: ${VALID_WX_VARIANTS.join(", ")}`);
          process.exit(1);
        }
      }
      continue;
    }
    if (a === "--wechat-slots") {
      const list = raw[++i];
      if (!list) {
        console.error("--wechat-slots 需要逗号分隔，如: diversion,body");
        process.exit(1);
      }
      wechatContentSlots = list.split(",").map((s) => s.trim()) as WechatContentSlot[];
      for (const s of wechatContentSlots) {
        if (!VALID_SLOTS.includes(s)) {
          console.error(`未知槽位: ${s}，可选: ${VALID_SLOTS.join(", ")}`);
          process.exit(1);
        }
      }
      continue;
    }
    if (a === "--") continue;
    parts.push(a);
  }

  const query = parts.join(" ").trim();
  return {
    query,
    collections,
    wechatStyleVariants,
    wechatContentSlots,
  };
}

async function main(): Promise<void> {
  const { query, collections, wechatStyleVariants, wechatContentSlots } =
    parseArgs();
  if (!query) {
    console.error(
      '用法: pnpm run search:rag -- "查询"  或加 --only job_post,platform_tone [--wechat-variants medsci] [--wechat-slots diversion]',
    );
    process.exit(1);
  }
  if (!existsSync(DEFAULT_RAG_STORE_PATH)) {
    console.error(
      `未找到 ${DEFAULT_RAG_STORE_PATH}\n请先: pnpm run ingest:presets && pnpm run ingest:jobs`,
    );
    process.exit(1);
  }

  const client = createEmbeddingClient();
  const hits = await retrieve(client, query, {
    collections,
    wechatStyleVariants,
    wechatContentSlots,
    topK: 8,
  });

  const storeLabel = collections?.length ?
    collections.join(", ")
  : "全部集合";
  const wxExtra =
    [
      wechatStyleVariants?.length ?
        `子风格=${wechatStyleVariants.join(",")}`
      : "",
      wechatContentSlots?.length ? `槽位=${wechatContentSlots.join(",")}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  console.log(
    `查询: ${query}\n范围: ${storeLabel}${wxExtra ? `  ${wxExtra}` : ""}\n`,
  );

  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]!;
    const c = h.chunk;
    const slot =
      c.collection === "wechat_style" && c.wechatContentSlot ?
        ` slot=${c.wechatContentSlot}`
      : "";
    console.log(
      `--- #${i + 1} score=${h.score.toFixed(4)} [${c.collection}]${slot} ${c.sourceLabel} ---`,
    );
    console.log(c.text.slice(0, 700) + (c.text.length > 700 ? "…" : ""));
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
