/**
 * RAG 集合名：与《实现路线图》及《知识库分层与文献库规划》对齐。
 * - `literature`：事实层（论文/指南等可核对来源）
 * - `wechat_style`：表达层——微信医学长文语料（语气/结构参考），**非事实依据**；块级见 {@link WechatStyleVariant}
 */
export type KnowledgeCollection =
  | "job_post"
  | "platform_tone"
  | "medical"
  | "personal"
  | "literature"
  | "wechat_style";

/**
 * `wechat_style` 集合内：良医汇肿瘤资讯系 vs 梅斯学术系，可单独检索或混合检索（不传 `wechatStyleVariants` 即全量）。
 */
export type WechatStyleVariant = "liangyi_hui" | "medsci";

/**
 * 微信成稿内向量槽位：正文 / 图注 / 导流 / 参考文献区 / 署名 / 文末运营与转载等。
 * 见 `tools/knowledge-importer` 中的微信风格入库逻辑。
 */
export type WechatContentSlot =
  | "body"
  | "caption"
  | "diversion"
  | "references"
  | "byline"
  | "footer";

export type SectionPriority = "high" | "normal" | "low";

export interface TextChunk {
  id: string;
  collection: KnowledgeCollection;
  /** 导入器侧稳定主键：文献通常为 DOI，微信通常为 kb_wechat_id */
  sourceId?: string;
  /** 仓库内相对路径，便于追溯 */
  sourcePath: string;
  /** 人类可读来源，如「公司名-职位名」或论文短标题 */
  sourceLabel: string;
  text: string;
  chunkIndex: number;
  /**
   * 事实层文献：稳定主键。**优先**为注册 DOI（`10.xxxx/...`），与 `sourceUrl` 指向的 DOI 一致时
   * 多篇 `.md` 视为同一篇论文的补充块；无 DOI 时为文件名/meta 短 slug。
   */
  paperId?: string;
  /** 事实层文献：原始条目 URL，通常为 `https://doi.org/10....` */
  sourceUrl?: string;
  /** 仅 `collection === "wechat_style"`：区分良医汇 / 梅斯，供检索侧过滤 */
  wechatStyleVariant?: WechatStyleVariant;
  /** 仅 `wechat_style`：槽位（导流 / 文献块 / 署名等），供定向检索 */
  wechatContentSlot?: WechatContentSlot;
  /** 仅 `wechat_style`：与清洗稿 YAML `kb_wechat_id` 一致 */
  kbWechatId?: string;
  /** 可选：章节/段落语义，如 abstract / results / methods */
  sectionType?: string;
  /** 可选：导入器侧章节优先级，用于入库与检索差异化 */
  sectionPriority?: SectionPriority;
}

export interface StoredVectorChunk extends TextChunk {
  embedding: number[];
}

export interface VectorStoreFile {
  version: 1;
  embeddingModel: string;
  createdAt: string;
  chunks: StoredVectorChunk[];
}
