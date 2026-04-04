import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";

import { getAnthropicClient } from "../anthropic.js";
import {
  fetchMedsciLiteratureRagContext,
  parseMedsciLiteratureWechatRequest,
  verifyLiteratureForMedsciWechat,
} from "./medsci-literature-wechat.js";
import { createEmbeddingClient } from "../../knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../../knowledge/paths.js";
import { CONTENT_RAG_DEFAULT_COLLECTIONS } from "../../knowledge/rag-default-collections.js";
import { retrieve } from "../../knowledge/retrieve.js";
import {
  createDocumentWithPlainText,
} from "../../lark/docx-document.js";
import type { SearchHit } from "../../knowledge/vector-file-store.js";
import { loadMemory, saveMemory, type MemoryStore } from "../../memory/store.js";
import {
  buildBriefAcknowledgmentPreamble,
  buildBriefSummaryBlock,
  extractWriteBriefSignals,
  shouldForceReadyForDraftCollaboration,
  shouldForceReadyForEditorHandoff,
  shouldRelaxXhsOverride,
} from "./write-brief.js";

/** 第一跳：判断是否可成稿；若用户已授权编辑把握边界，可放行避免重复追问 */
const CLARIFICATION_GATE_SYSTEM = `你是医学新媒体编辑流程中的「动笔前核对」环节。判断：当前材料是否已足以**在合规前提下**撰写对外稿件（科普/营销类）。

**硬性规则（高于一切）**：
- 若 **【从用户原话中读取的要点】** 已写明：用户将品牌/合规交由编辑判断、且明确**内审草稿/先出稿再谈合规**、并已提及受众与发布侧信息——则**必须**输出 \`GATE: READY\`，不得再以「材料矛盾」「缺批文号」等理由继续追问；成稿中可用审慎表述与文末风险说明代替反复确认。
- 若 **【从用户原话中读取的要点】** 显示用户已说明广审/资质账户/品牌认知向/由编辑把关，且材料已覆盖受众与主体——倾向 \`GATE: READY\`，**不要**用知识库里的公司画像与用户最新说明打架。
- 仅当用户**完全未**给出受众或发布场景、且未授权编辑裁量时，才因「公域处方药」输出 \`GATE: ASK\`。
- 知识库与公司画像**不能替代**用户对本篇的授权；但若用户原话已授权编辑，**不得以知识库推断未确认**。

**可输出 \`GATE: READY\` 的情况**：
- 用户已授权编辑决定剩余选项，且【要点】中受众、发布侧、目的至少已覆盖；或
- 用户明确内审草稿、合规后置；或
- 用户明确只做通用科普、不提具体处方药承诺。

**输出格式（必须严格遵守）**：
- 第一行只能是：\`GATE: READY\` 或 \`GATE: ASK\`（不要加反引号、不要加 Markdown）。
- \`GATE: ASK\` 时：第二行起为编号追问；**只问当前仍缺失、且未被【要点】覆盖的 1～3 条**，勿重复用户已回答的维度。
- \`GATE: READY\` 时：第一行后不要输出任何字符。

在「可交内审草稿」与「必须再追问」之间犹豫时，**倾向 \`GATE: READY\`**。`;

/** 系统规则仍认为材料不齐时，由模型根据全文生成「只补缺」的追问（替代写死模板） */
const ALIGNMENT_FOLLOW_UP_SYSTEM = `你是医学新媒体编辑，正在与用户对齐一篇对外稿件（小红书/公众号等）的创作需求。

你的任务：阅读下方**完整用户原话**与【从用户原话中读取的要点】，判断**还有哪些信息对成稿仍然关键、且尚未说清**；输出**编号追问列表**供用户补充。

硬性要求：
- **禁止**重复用户已经明确回答过的维度（例如已说「科普向」「个人内容号」就不要再问「受众是大众还是医生」「账号类型」等同义问题）。
- 若用户已覆盖受众、账号/发布侧、目的与合规取向中的大部分，只问**仍缺的一两项**，或一条收口确认即可；**不要**为凑数硬凑 4 条。
- 追问要**具体、可一句答清**；涉及处方药/品牌/功效时，问的是**本篇要采用的表述边界**，而不是泛泛普法。
- 输出格式：使用 Markdown 编号列表，从 \`1.\` 起；每条可加粗小标题；**不要**开场白、结语、GATE 行或「以下是」类套话。`;

const GENERATION_SYSTEM = `你是医学新媒体编辑。根据用户任务、已确认的信息与知识库参考片段，撰写可直接对外使用的稿件。
要求：
- **输出结构（必须严格遵守，否则下游无法解析）**：
  - 第 1 行：**仅一行**——本篇拟在平台使用的**发布标题**（面向读者、符合该平台阅读习惯：小红书要抓人、口语化；公众号可稍正式；避免把「新型××制剂」「关于××的科普」这类偏学术或像论文主题词的短语直接当标题，除非用户明确要求；合规前提下可适度用问句、场景或痛点，禁止标题党与违规用语）。
  - 第 2 行：必须为空行。
  - 第 3 行起：**正文**，段落之间空一行；正文内不要重复第一行的标题；不要使用 Markdown 标题符号（如 #）。
- **只使用用户已确认的事实与知识库片段**；不得编造数据、病例、批文、疗效细节或产品信息；不确定处用审慎表述或删去，禁止杜撰补全。
- 医学表述审慎，不夸大疗效；遵守广告法，避免绝对化用语。
- 知识库片段仅供风格与事实参考；若与用户最新说明冲突，以用户为准。
- **平台与体裁**：若用户指定了小红书、知乎、微信公众号、朋友圈等，须按该平台的**常识级阅读习惯与语气**写作（短段落、节奏、称呼等）；后续接入专属「运营知识库」时仅作增强，**没有知识库时也应具备基本平台感**。医学与合规底线不因平台而降低。
- 不要开场白或后记说明；不要在正文里向读者列出「待确认」类运营问题（运营侧确认应在成稿前完成）。`;

/** 文献→仿梅斯微信公众号特化（与 GENERATION_SYSTEM 拼接） */
const MEDSCI_LITERATURE_WECHAT_GENERATION_APPEND = `

【本篇特化】用户要求将文献库条目改写为**仿梅斯学术**的**微信公众号长文**：
- 研究事实、数据与结论**仅可**引用【知识库参考】中标记为 literature 的段落；
- 标记为 wechat_style 的段落**仅作**标题节奏、分段方式与语气参考，**不得**当作研究事实来源；
- 若文献片段不足以支撑成稿，须用审慎表述说明局限，禁止杜撰实验结果。`;

/**
 * 去掉飞书 @、零宽字符等，避免意图识别失败。
 */
export function normalizeUserTextForIntent(raw: string): string {
  let t = raw.trim();
  t = t.replace(/\u200b/g, "");
  t = t.replace(/<at[^>]*>([^<]*)<\/at>/gi, " ");
  t = t.replace(/@_user_[^\s@]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * 是否走「写一篇 → 检索 → 生成 → 飞书文档」工作流（与「改写/删改」等区分）。
 */
export function isContentCreateIntent(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 4) return false;
  if (/改写|删改|修改一下|调整一下|缩短|加长|润色|优化一下|把.+改/.test(t)) {
    return false;
  }
  /** 注意「帮我再写一篇」：再 插在 我 与 写 之间，必须有 (?:再|重)? 或独立子串「再写…」 */
  const wantsCreate =
    /(?:请|麻烦|帮忙)?帮我(?:再|重)?写(?:一|篇|则|个)|(?:请|麻烦|帮忙)?(?:帮我)?写(?:一|篇|则|个)|再写(?:一|篇|则|个)|再来一(?:篇|则)|重新写(?:一|篇|则|个)?|(?:请|麻烦|帮忙)?帮我写个|起草|撰写|来一(?:篇|则)|来篇|整一(?:篇|个)|给一(?:篇|个)|输出一(?:篇|个)|创作(?:一)?(?:篇|则)?/.test(
      t,
    ) || /^写(?:一|篇|则|个)/.test(t);
  const hasGenre =
    /(?:笔记|文章|文案|稿|内容|小红书|公众号|知乎|推文|帖子|软文|朋友圈|微博|长文|短文)/.test(
      t,
    );
  /** 「写一篇关于……的（文章|笔记）」类：体裁词可能在句末 */
  const writeAboutTopic =
    /写(?:一|篇|则|个)?关于/.test(t) &&
    /(笔记|文章|小红书|公众号|知乎|文案|科普|推文|帖子)/.test(t);
  return (wantsCreate && hasGenre) || writeAboutTopic;
}

/** 含「仿梅斯文献→微信」固定句式，供合并窗口与路由识别 */
export function isWriteTaskIntent(userText: string): boolean {
  return (
    isContentCreateIntent(userText) ||
    parseMedsciLiteratureWechatRequest(userText) !== null
  );
}

/**
 * 短句「再写一篇」类：无新主题，复用会话中**最近一条**完整创作指令。
 * 若整句还包含新的体裁/主题要求，应走普通创作意图，不归此类。
 */
export function isRepeatWriteShortcut(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 3 || t.length > 48) return false;
  if (isWriteTaskIntent(t)) return false;
  /** 注意：「再写一篇」是 再写+一篇，不能写成 再写+(?:一|篇)?，否则只匹配到「再写一」剩个「篇」导致整句不匹配 */
  const shortRepeat =
    /^(?:请|麻烦|帮我)?(?:再写(?:一篇|一则|一个|一遍)?|再来(?:一篇|一则|一个)?|重新写(?:一篇|一则|一个)?|再生成(?:一篇)?)[。.!！？\s]*$/u;
  const okLine =
    /^(?:好的|好|行|可以|OK|ok)[，,]?\s*(?:请|麻烦|帮我)?(?:再写(?:一篇|一则|一个|一遍)?|再来(?:一篇|一则)?)[。.!！？\s]*$/iu;
  return shortRepeat.test(t) || okLine.test(t);
}

/**
 * 从会话中取**最近一条**用户侧创作指令（`isWriteTaskIntent` 为真），供「再写一篇」复用。
 */
export function extractLastWriteTaskInstruction(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string | null {
  const userMsgs: string[] = [];
  for (const m of history) {
    if (m.role === "user") userMsgs.push(m.content);
  }
  for (let j = userMsgs.length - 1; j >= 0; j--) {
    const n = normalizeUserTextForIntent(userMsgs[j]!);
    if (isWriteTaskIntent(n)) {
      return userMsgs[j]!.trim();
    }
  }
  return null;
}

/**
 * 当前用户句是否像「写作任务补充说明」，而非元对话/闲聊（避免与历史写作任务误合并）。
 */
export function isPlausibleWriteMergeFollowUp(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 6) return false;
  if (isRepeatWriteShortcut(t)) return false;
  if (isContentCreateIntent(t)) return false;
  if (
    /(?:你)?现在.{0,8}(?:对|跟).{0,10}(?:我|咱).{0,10}(?:的)?(?:了解|认识|知道)|了解多少|知道我多少|你还记得|刚才|你为什么|什么模型|谁开发|测试|你好|谢谢|再见|离谱|怎么回事/.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * 从会话中取「最近一次带创作意图的用户句」起的多条用户发言，合并为一次成稿任务（含追问后补充）。
 */
export function buildMergedWriteRequest(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentUserText: string,
): string | null {
  const userMsgs: string[] = [];
  for (const m of history) {
    if (m.role === "user") userMsgs.push(m.content);
  }
  userMsgs.push(currentUserText);
  const windowStart = Math.max(0, userMsgs.length - 10);
  let start = -1;
  for (let j = userMsgs.length - 1; j >= windowStart; j--) {
    const n = normalizeUserTextForIntent(userMsgs[j]!);
    if (isWriteTaskIntent(n)) {
      start = j;
      break;
    }
  }
  if (start < 0) return null;
  const slice = userMsgs.slice(start).map((s) => s.trim());
  return slice.join("\n\n---\n\n");
}

function formatProfileBlock(memory: MemoryStore): string {
  const p = memory.companyProfile;
  if (!p) return "（尚未记录公司画像；成稿前须以用户最新说明为准。）";
  const lines: string[] = [];
  if (p.name) lines.push(`公司名称：${p.name}`);
  if (p.products) lines.push(`主营：${p.products}`);
  if (p.targetCustomers) lines.push(`目标客户：${p.targetCustomers}`);
  if (p.brandTone) lines.push(`品牌调性：${p.brandTone}`);
  if (p.competitors) lines.push(`竞品：${p.competitors}`);
  if (p.notes) lines.push(`补充：${p.notes}`);
  return lines.length > 0 ? lines.join("\n") : "（画像待补充。）";
}

async function fetchRagContext(userText: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY || !existsSync(DEFAULT_RAG_STORE_PATH)) {
    return "（当前无向量库或未配置 OPENAI_API_KEY，跳过检索。）";
  }
  try {
    const client = createEmbeddingClient();
    const hits = await retrieve(client, userText.trim(), {
      collections: [...CONTENT_RAG_DEFAULT_COLLECTIONS],
      topK: 10,
    });
    if (hits.length === 0) return "（检索无命中片段。）";
    return hits
      .map(
        (h, i) =>
          `[#${i + 1} ${h.chunk.collection} | ${h.chunk.sourceLabel}]\n${h.chunk.text}`,
      )
      .join("\n\n---\n\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-create] RAG 检索失败:", msg);
    return `（检索失败：${msg.slice(0, 120)}）`;
  }
}

/** 去掉误捕获的量词、空白，限制长度 */
function cleanTitleCandidate(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:一篇|一则|一个|这篇|那篇|篇|一|则|个)(?=[\u4e00-\u9fa5])/u, "");
  return s.slice(0, 80).replace(/[。，、；：]+$/g, "").trim();
}

/**
 * 从用户任务句抽取文档标题；避免旧正则把「一篇」拆成「篇xxx」。
 */
function deriveDocumentTitle(userText: string): string {
  const t = userText.trim();

  const ordered: RegExp[] = [
    /《([^》\n]{2,40})》/,
    /写(?:一篇|一则|一个)\s*关于\s*(.+?)\s*的(?:文章|笔记|小红书|科普|推文|文案)/,
    /(?:写|起草|撰写)(?:一|篇|则|个)\s*关于\s*[「《]?\s*([^」》\n]{2,50}?)\s*[」》]?\s*的/,
    /(?:写|起草|撰写)(?:一|篇|则|个)\s*(.+?)(?:的科普|的小红书笔记|的小红书|的笔记|的公众号|的知乎|的文章|的文案|的推文)/,
    /(?:写|起草|撰写)(?:一|篇|则|个)\s*(.+?)(?:笔记|文章|文案|稿)(?:$|[\s，。])/,
    /关于\s*[「《]?\s*([^」》\n]{2,45}?)\s*[」》]?\s*(?:的)?(?:科普)?(?:小红书)?(?:笔记|文章)?/,
  ];

  for (const re of ordered) {
    const m = t.match(re);
    if (m?.[1]) {
      const c = cleanTitleCandidate(m[1]);
      if (c.length >= 2) return c;
    }
  }

  const fallback = t
    .replace(/^(?:请|麻烦|帮忙)?(?:帮我)?(?:再|重)?(?:写|起草|撰写)(?:一|篇|则|个)?/u, "")
    .replace(
      /(?:的)?(?:科普)?(?:小红书|公众号|知乎)?(?:笔记|文章|文案|稿|内容|推文|帖子).*$/u,
      "",
    )
    .trim();
  const fb = cleanTitleCandidate(fallback || t);
  if (fb.length >= 4 && fb.length <= 80) return fb;

  return `内容稿件-${new Date().toISOString().slice(0, 10)}`;
}

/**
 * 未接平台运营知识库时，仍按常识注入对应平台阅读与语气习惯。
 */
function buildPlatformStyleBlock(userText: string): string {
  const t = normalizeUserTextForIntent(userText);
  if (/小红书|小红薯/.test(t)) {
    return [
      "【平台风格（常识，用于成稿；不依赖专属运营知识库）】",
      "小红书笔记：标题抓人、口语化；正文短段落、适合手机划读；可适度使用 emoji（不要堆砌）；开头有「钩子」、结尾可轻互动；医学内容仍须准确、合规，避免软文腔夸大疗效。",
    ].join("\n");
  }
  if (/知乎/.test(t)) {
    return [
      "【平台风格（常识）】",
      "知乎：可先亮观点再展开；分段清晰、信息密度适中；避免过度营销腔；医学事实须可核对、表述审慎。",
    ].join("\n");
  }
  if (/公众号|微信(?:公众)?号|推文/.test(t)) {
    return [
      "【平台风格（常识）】",
      "微信公众号/推文：可中等篇幅；导语抓人、小标题分段；兼顾可读性与专业感；合规表述。",
    ].join("\n");
  }
  if (/朋友圈/.test(t)) {
    return [
      "【平台风格（常识）】",
      "朋友圈：极短、口语化；少术语堆砌；合规优先。",
    ].join("\n");
  }
  if (/微博/.test(t)) {
    return [
      "【平台风格（常识）】",
      "微博：短句、话题感；敏感表述谨慎。",
    ].join("\n");
  }
  return [
    "【平台风格（常识）】",
    "用户若已说明体裁（笔记/文章等），按移动端阅读习惯：短段落、清晰分段；未指定平台则默认通俗、易扫读。",
  ].join("\n");
}

function stripAssistantNoise(text: string): string {
  return text
    .replace(/^[\s\n]*(?:以下是|下面是|正文如下)[:：]?\s*/i, "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "").trim())
    .trim();
}

/**
 * 解析生成结果：第 1 行为发布标题，第 2 行为空行，第 3 行起为正文。若格式不符则回退为从任务句抽标题 + 全文作正文。
 */
function splitGeneratedTitleAndBody(
  cleaned: string,
  userText: string,
): { title: string; body: string } {
  const normalized = cleaned.trim();
  const lines = normalized.split(/\r?\n/);
  if (lines.length < 2) {
    return {
      title: deriveDocumentTitle(userText),
      body: normalized || cleaned.trim(),
    };
  }

  const titleLine = lines[0]!
    .replace(/^【\s*标题\s*】\s*/u, "")
    .replace(/^TITLE[:：]\s*/i, "")
    .trim();
  let i = 1;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  const body = lines.slice(i).join("\n").trim();

  const titleOk =
    titleLine.length >= 2 &&
    titleLine.length <= 80 &&
    !/^#{1,6}\s/.test(titleLine);

  if (!titleOk || !body) {
    return {
      title: deriveDocumentTitle(userText),
      body: normalized,
    };
  }

  return { title: titleLine.slice(0, 80), body };
}

/** 小红书等 + 医药营销敏感词：未显式豁免时不得跳过闸门、不得 READY */
function isPublicPlatformMedicalMarketingRisk(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  const publicPlatform =
    /小红书|小红薯|抖音|快手|微博|B站|bilibili|视频号/.test(t);
  const medicalProductAngle =
    /处方|处方药|药品|商品名|品牌名|单抗|疫苗|斯泰度塔|泰诺麦博|功效|适应症|推广|背书|带货|种草/.test(
      t,
    );
  return publicPlatform && medicalProductAngle;
}

/** 用户声明本篇可先草稿、不提品牌、或合规边界已说明 */
function userWaivedOrBoundedCompliance(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  return (
    /(?:只是|这)?一篇?草稿|讨论稿|内审|先写|写完(?:再|之后)|合规.{0,14}(?:等|之后|再来|再谈)|(?:等|之后).{0,8}(?:再)?谈合规/.test(
      t,
    ) ||
    /(?:草稿|初稿|内部|先不管|暂不|不计).{0,8}(?:合规|审核|投放)/.test(t) ||
    /只做通用科普|通用科普|不提(?:具体)?(?:品牌|商品名|药名)|不写品牌|不出现.{0,4}商品名/.test(
      t,
    ) ||
    /合规(?:风险|边界|方案).{0,12}(?:已|都|你定|由你|清楚|说明)/.test(t) ||
    /(?:受众|发布主体|账号|品牌表述).{0,20}(?:已|都)(?:说|讲|定|明确)/.test(t)
  );
}

/**
 * 用户已说明受众/主体/目的，并授权编辑把握剩余边界时，可跳过闸门。
 * 公域平台 + 医药敏感题材时，除非用户已豁免/划界，否则绝不跳过。
 */
function shouldSkipClarificationGate(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 24) return false;

  if (isPublicPlatformMedicalMarketingRisk(t) && !userWaivedOrBoundedCompliance(t)) {
    return false;
  }

  const delegated =
    /(?:由你|你来)(?:定|判断|把握|决定)|你看着(?:办|定)|自己看着|把握原则|不必再追问|别再问|可以动笔|剩下的|授权|目的(?:已经|也已|都)?[^。]{0,12}明确|我知道你想|选项.*(?:由你|你来)|由你来定|你定就好|你把握|边界.*你|怎样好.*由你/.test(
      t,
    );
  const hasAudience =
    /受众|面向[^。，]{0,12}(?:大众|用户|患者|读者)|普通大众|目标受众|给患者|给大众|专业人士|医生|患者端/.test(
      t,
    );
  const hasPublisher =
    /发布主体|主体是|账号|署名|品牌方|良医汇|泰诺麦博|发布(?:方|账号)|(?:的|在)(?:小红书|公众号|知乎)(?:账号|笔记|矩阵)?/.test(
      t,
    );
  const hasPurpose =
    /科普|传播|认知|教育|草稿|审核|宣传|目的|带着|产品|转化|投放/.test(t);

  return delegated && hasAudience && hasPublisher && hasPurpose;
}

/**
 * 模型若误报 READY，用规则兜底再打回追问（避免无确认直接成稿）。
 * 小红书类对外稿：用户一句话里须能看出受众、发布主体、以及品牌/目的或合规取向（知识库不能算）。
 */
function shouldOverrideReadyToAsk(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (userWaivedOrBoundedCompliance(t)) return false;
  if (shouldRelaxXhsOverride(t)) return false;

  const xhsWrite =
    /(?:小红书|小红薯)/.test(t) &&
    /(?:写|撰|起草|来一|笔记|文章|文案)/.test(t);
  if (!xhsWrite) return false;

  const hasAudience =
    /受众|面向|给(?:谁|读者)|普通大众|患者|医生|专业人士|大众|医护|用户/.test(t);
  const hasPublisher =
    /发布主体|哪.{0,8}(?:账号|方)|署名|账号|良医汇|泰诺麦博|品牌方|甲方|合作方|我方|客户方|有资质|医疗账户|医疗机构|广审|广告审批/.test(
      t,
    );
  /** 未说具体账号，但已明确对外/终稿/公域等发布场景，不应再被机械规则挡 */
  const hasPublishScene =
    /对外(?:终稿|发布)?|终稿|公域|公开发布|可对外|对外投放/.test(t);
  const publisherOk = hasPublisher || hasPublishScene;
  const hasBrandOrGoal =
    /品牌|商品名|通用科普|不提.{0,4}品牌|处方药|合规|功效|推广|背书|草稿|侧重|目的|科普为主|认知|转化|是否点名|科普/.test(
      t,
    );

  if (isPublicPlatformMedicalMarketingRisk(t)) {
    return !(hasAudience && publisherOk && hasBrandOrGoal);
  }

  return !(hasAudience && publisherOk && hasBrandOrGoal);
}

function buildFallbackClarificationBlock(userText: string): string {
  const t = normalizeUserTextForIntent(userText);
  const rxNote =
    isPublicPlatformMedicalMarketingRisk(t) || /破伤风|处方|单抗|疫苗|药/.test(t) ?
      [
        "",
        "有一点提前说明：若涉及具体处方药商品名与功效宣传，在公域平台公开投放可能存在合规风险；若只做通用机制科普、不出现商品名，风险相对可控。请先对齐边界。",
      ]
    : [];

  return [
    "先确认几个点，写完再动笔：",
    "",
    "1. **受众**：面向普通大众，还是医疗专业人士？",
    "2. **是否点名产品**：需要出现具体品牌/商品名，还是通用科普、不做品牌背书？",
    "3. **发布主体**：哪一方账号发布（例如合作方/自有矩阵）？影响免责声明与语气。",
    "4. **核心诉求**：以疾病科普为主，还是产品/品类认知教育为主？",
    ...rxNote,
  ].join("\n");
}

/**
 * 机械规则与简报仍认为不齐时，由大模型根据合并上下文生成**仅针对缺口**的追问（API 失败则回退模板）。
 */
async function generateAlignmentFollowUpQuestions(
  userPayload: string,
  model: string,
): Promise<string> {
  try {
    const res = await getAnthropicClient().messages.create({
      model,
      max_tokens: 900,
      system: ALIGNMENT_FOLLOW_UP_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${userPayload}\n\n请只输出仍需对齐的编号追问（1～4 条）；若你认为材料已足够，只输出 1 条收口确认即可。`,
        },
      ],
    });
    const raw =
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "";
    const cleaned = stripAssistantNoise(raw);
    if (cleaned.length >= 12) {
      return cleaned;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-create] 动态对齐追问生成失败:", msg);
  }
  return buildFallbackClarificationBlock(userPayload);
}

/** 用户可见追问里去掉模型误露的 GATE 行与代码块标记 */
function sanitizeAskQuestionsForUser(raw: string): string {
  return raw
    .replace(/^[`\s]*GATE:\s*ASK[`\s]*\r?\n?/gim, "")
    .replace(/^```\s*GATE:\s*ASK\s*```\s*\r?\n?/gim, "")
    .replace(/\n[`\s]*GATE:\s*ASK[`\s]*/gi, "\n")
    .trim();
}

/**
 * 解析闸门输出：无法解析或缺少 GATE 行时 **视为未就绪**（不自动成稿）。
 */
function parseClarificationGateResponse(text: string): { ready: true } | { ready: false; questions: string } {
  const trimmed = text.trim();
  const firstNl = trimmed.search(/\r?\n/);
  const firstLine = (firstNl === -1 ? trimmed : trimmed.slice(0, firstNl)).trim();
  const rest = firstNl === -1 ? "" : trimmed.slice(firstNl).trim();

  const m = firstLine.match(/^GATE:\s*(READY|ASK)\s*$/i);
  if (m) {
    if (m[1]!.toUpperCase() === "READY") {
      return { ready: true };
    }
    return {
      ready: false,
      questions: sanitizeAskQuestionsForUser(
        rest || "请补充关键信息（受众、平台、是否涉及具体产品与功效边界等）后再撰写。",
      ),
    };
  }

  return {
    ready: false,
    questions: sanitizeAskQuestionsForUser(
      trimmed ||
        "请先说明受众、发布平台、以及是否涉及处方药/具体产品与功效表述，我再动笔。",
    ),
  };
}

export interface ContentCreateWorkflowOptions {
  /** 当前发消息用户的 open_id，用于创建 docx 后授予「可管理」协作者权限 */
  senderOpenId?: string;
  /**
   * 用户已在飞书交互卡片提交结构化参数：跳过动笔前闸门、机械追问与动态追问，直接成稿。
   */
  skipAlignmentGates?: boolean;
}

/**
 * 检索 → **动笔前核对** →（仅 READY）生成 → 创建飞书云文档；ASK 时只回复追问，不创建文档。
 */
export async function runContentCreateWorkflow(
  _chatId: string,
  userText: string,
  workflowOpts: ContentCreateWorkflowOptions = {},
): Promise<string> {
  const memory = loadMemory();

  const medsciLitParsed = parseMedsciLiteratureWechatRequest(userText);
  let medsciLiteratureWechatMode = false;
  let medsciVerifiedHits: SearchHit[] = [];

  if (medsciLitParsed) {
    if (!process.env.OPENAI_API_KEY || !existsSync(DEFAULT_RAG_STORE_PATH)) {
      return [
        "当前无法检索文献库与梅斯风格库（请配置 OPENAI_API_KEY，并确保已灌库且存在 data/knowledge/rag-store.json）。",
        "",
        "未继续成稿。",
      ].join("\n");
    }
    const verified = await verifyLiteratureForMedsciWechat(
      medsciLitParsed.literatureTopic,
    );
    if (!verified.ok) {
      return [
        `未在文献库中找到与「${medsciLitParsed.literatureTopic}」可对齐的条目。`,
        "",
        "请联系我老板上传该文献后再试。",
      ].join("\n");
    }
    medsciLiteratureWechatMode = true;
    medsciVerifiedHits = verified.hits;
  }

  const ragBlock =
    medsciLiteratureWechatMode && medsciLitParsed ?
      await fetchMedsciLiteratureRagContext(
        userText,
        medsciLitParsed.literatureTopic,
        medsciVerifiedHits,
      )
    : await fetchRagContext(userText);
  const profileBlock = formatProfileBlock(memory);

  const briefSignals = extractWriteBriefSignals(userText);
  const draftOrientation =
    briefSignals.draftMode || userWaivedOrBoundedCompliance(userText) ?
      [
        "",
        "【成稿取向】用户若要求内审草稿或合规后置：正文用审慎医学表述；可在文末简短标注待合规与投放确认，不视为可直接公域投放终稿。",
      ]
    : [];

  const medsciTaskNote =
    medsciLiteratureWechatMode ?
      [
        "",
        "【任务类型】仿梅斯学术微信公众号文章：事实以 literature 检索片段为准；语气与结构参考 wechat_style（梅斯）片段。",
      ]
    : [];

  const userPayload = [
    "【用户任务（含多轮合并时的完整原文）】",
    userText.trim(),
    "",
    buildBriefSummaryBlock(userText),
    "",
    buildPlatformStyleBlock(userText),
    ...draftOrientation,
    ...medsciTaskNote,
    "",
    "【公司画像】",
    profileBlock,
    "",
    "【知识库参考】",
    ragBlock,
  ].join("\n");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const skipGates = workflowOpts.skipAlignmentGates === true;

  let gateReady =
    skipGates ||
    medsciLiteratureWechatMode ||
    shouldSkipClarificationGate(userText);
  if (
    !gateReady &&
    (shouldForceReadyForDraftCollaboration(userText) ||
      shouldForceReadyForEditorHandoff(userText))
  ) {
    gateReady = true;
    console.log(
      "[content-create] 简报满足草稿协作或编辑全权条件，跳过动笔前闸门",
    );
  } else if (gateReady && !skipGates) {
    console.log(
      "[content-create] 用户已说明要素并授权编辑把握边界，跳过动笔前闸门，直接成稿",
    );
  }

  if (skipGates) {
    console.log("[content-create] 飞书卡片结构化参数已确认，跳过对齐闸门");
  }
  if (medsciLiteratureWechatMode) {
    console.log(
      "[content-create] 仿梅斯学术·文献微信公众号模式：文献已命中 + 双库检索，跳过动笔前闸门",
    );
  }

  if (!gateReady) {
    let gateText: string;
    try {
      const gateRes = await getAnthropicClient().messages.create({
        model,
        max_tokens: 900,
        system: CLARIFICATION_GATE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `${userPayload}\n\n请仅按系统说明输出 GATE 行及（若需要）追问列表。`,
          },
        ],
      });
      gateText =
        gateRes.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n") || "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[content-create] 动笔前核对失败:", msg);
      if (msg.includes("401") || msg.includes("auth")) {
        return "抱歉，模型身份凭证异常，请检查 ANTHROPIC_API_KEY。";
      }
      return `抱歉，动笔前核对环节失败：${msg.slice(0, 200)}`;
    }

    let gate = parseClarificationGateResponse(gateText);
    if (
      !gate.ready &&
      (shouldForceReadyForDraftCollaboration(userText) ||
        shouldForceReadyForEditorHandoff(userText))
    ) {
      console.warn(
        "[content-create] 模型闸门返回 ASK，但简报规则判定应 READY，覆盖为成稿",
      );
      gate = { ready: true };
    }
    if (!gate.ready) {
      const preamble = buildBriefAcknowledgmentPreamble(userText);
      return [
        preamble ?
          `${preamble}\n\n`
        : "收到，我会基于你前面已经说的来对齐，只问还没覆盖的点。\n\n",
        "**若补充下面即可动笔**（你已确认过的我不再重复问）：",
        "",
        gate.questions,
        "",
        "确认后我再撰写并写入飞书云文档（未确认前不会杜撰成稿）。",
      ].join("\n");
    }
  }

  if (!skipGates && !medsciLiteratureWechatMode && shouldOverrideReadyToAsk(userText)) {
    const preamble = buildBriefAcknowledgmentPreamble(userText);
    const questionsBlock = await generateAlignmentFollowUpQuestions(
      userPayload,
      model,
    );
    return [
      preamble ?
        `${preamble}\n\n`
      : "收到，我会基于你前面已经说的来对齐，只问还没覆盖的点。\n\n",
      "**若补充下面即可动笔**（你已确认过的我不再重复问）：",
      "",
      questionsBlock,
      "",
      "确认后我再撰写并写入飞书云文档（未确认前不会杜撰成稿）。",
    ].join("\n");
  }

  const generationSystem =
    medsciLiteratureWechatMode ?
      GENERATION_SYSTEM + MEDSCI_LITERATURE_WECHAT_GENERATION_APPEND
    : GENERATION_SYSTEM;

  let body: string;
  let title: string;
  try {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 4096,
      system: generationSystem,
      messages: [{ role: "user", content: userPayload }],
    });
    const rawBody =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "";
    const cleaned = stripAssistantNoise(rawBody);
    const split = splitGeneratedTitleAndBody(cleaned, userText);
    body = split.body;
    title = split.title;
    if (!body.trim()) {
      throw new Error("模型未返回正文");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-create] Claude 生成失败:", msg);
    if (msg.includes("401") || msg.includes("auth")) {
      return "抱歉，模型身份凭证异常，请检查 ANTHROPIC_API_KEY。";
    }
    return `抱歉，正文生成失败：${msg.slice(0, 200)}`;
  }
  const folderToken = process.env.FEISHU_DOC_FOLDER_TOKEN;

  try {
    const doc = await createDocumentWithPlainText(title, body, {
      folderToken: folderToken || undefined,
      grantEditToOpenId: workflowOpts.senderOpenId,
    });
    const fresh = loadMemory();
    fresh.lastDeliveredDoc = {
      documentId: doc.documentId,
      url: doc.url,
      title,
      createdAt: new Date().toISOString(),
    };
    saveMemory(fresh, { bumpInteraction: false });

    const grantLine =
      doc.collaboratorGranted === true ?
        "已为你开通该文档的编辑与管理类权限（飞书「可管理」协作者），可直接在链接内修改。"
      : doc.collaboratorGranted === false && workflowOpts.senderOpenId ?
        "（未能自动添加你为协作者：请管理员检查开放平台云文档/云空间权限；你仍可通过分享链接申请编辑。）"
      : "";

    return [
      "已写好并保存到飞书云文档（新版 docx）。",
      `标题：${title}`,
      `链接：${doc.url}`,
      ...(grantLine ? ["", grantLine] : []),
      "",
      "如需修改语气或补充要点，直接说具体段落即可。",
    ].join("\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[content-create] 飞书文档写入失败:", msg);
    return [
      "正文已生成，但写入飞书云文档失败。请检查应用权限（docx:document）与网络。",
      `错误摘要：${msg.slice(0, 200)}`,
      "",
      "—— 以下为生成正文预览 ——",
      "",
      body.slice(0, 1500) + (body.length > 1500 ? "\n…（已截断）" : ""),
    ].join("\n");
  }
}
