import type OpenAI from "openai";
import { existsSync } from "node:fs";

import { embedTexts } from "./embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "./paths.js";
import { loadVectorStore, searchVectorStore, type SearchHit } from "./vector-file-store.js";
import type {
  KnowledgeCollection,
  SectionPriority,
  WechatContentSlot,
  WechatStyleVariant,
} from "./types.js";

export interface RetrieveOptions {
  /** 限定检索的集合；不传则检索库内全部集合 */
  collections?: KnowledgeCollection[];
  /**
   * 仅作用于 `wechat_style` 块：限定良医汇 / 梅斯子风格。
   * 不传或空数组：不额外过滤（与 `collections` 含 `wechat_style` 时即「混合参考全部微信风格」）。
   */
  wechatStyleVariants?: WechatStyleVariant[];
  /**
   * 仅作用于 `wechat_style` 块：限定槽位（导流 / 正文 / 文献区等）。
   * 不传或空数组：不按槽位过滤。旧块无 `wechatContentSlot` 时视为仅在与 `body` 一并请求时命中。
   */
  wechatContentSlots?: WechatContentSlot[];
  topK: number;
  /** 默认 `data/knowledge/rag-store.json` */
  storePath?: string;
}

function passesWechatStyleFilter(
  collection: KnowledgeCollection,
  variant: WechatStyleVariant | undefined,
  requested: WechatStyleVariant[] | undefined,
): boolean {
  if (collection !== "wechat_style") return true;
  if (!requested?.length) return true;
  if (variant == null) return false;
  return requested.includes(variant);
}

function passesWechatContentSlotFilter(
  collection: KnowledgeCollection,
  slot: WechatContentSlot | undefined,
  requested: WechatContentSlot[] | undefined,
): boolean {
  if (collection !== "wechat_style") return true;
  if (!requested?.length) return true;
  const effective = slot ?? "body";
  return requested.includes(effective);
}

function boostScoreForSectionPriority(
  collection: KnowledgeCollection,
  priority: SectionPriority | undefined,
): number {
  if (collection !== "literature") return 0;
  switch (priority) {
    case "high":
      return 0.03;
    case "low":
      return -0.02;
    default:
      return 0;
  }
}

/**
 * 对查询句嵌入后，在向量库中做余弦相似度 topK（可选按集合过滤）。
 */
export async function retrieve(
  client: OpenAI,
  query: string,
  options: RetrieveOptions,
): Promise<SearchHit[]> {
  const path = options.storePath ?? DEFAULT_RAG_STORE_PATH;
  if (!existsSync(path)) {
    throw new Error(
      `向量库不存在: ${path}（请先执行 pnpm run ingest:presets / ingest:jobs）`,
    );
  }
  const store = loadVectorStore(path);
  const requestedVariants = options.wechatStyleVariants;
  const requestedSlots = options.wechatContentSlots;
  const chunks =
    options.collections?.length ?
      store.chunks.filter(
        (c) =>
          options.collections!.includes(c.collection) &&
          passesWechatStyleFilter(
            c.collection,
            c.wechatStyleVariant,
            requestedVariants,
          ) &&
          passesWechatContentSlotFilter(
            c.collection,
            c.wechatContentSlot,
            requestedSlots,
          ),
      )
    : store.chunks.filter(
        (c) =>
          passesWechatStyleFilter(
            c.collection,
            c.wechatStyleVariant,
            requestedVariants,
          ) &&
          passesWechatContentSlotFilter(
            c.collection,
            c.wechatContentSlot,
            requestedSlots,
          ),
      );
  const subStore = { ...store, chunks };
  const [qvec] = await embedTexts(client, [query]);
  const hits = searchVectorStore(subStore, qvec, Math.max(options.topK * 3, options.topK));
  const rescored = hits.map((hit) => ({
    ...hit,
    score:
      hit.score +
      boostScoreForSectionPriority(hit.chunk.collection, hit.chunk.sectionPriority),
  }));
  rescored.sort((a, b) => b.score - a.score);
  return rescored.slice(0, options.topK);
}
