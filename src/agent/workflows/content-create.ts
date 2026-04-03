import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";

import { getAnthropicClient } from "../anthropic.js";
import { createEmbeddingClient } from "../../knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../../knowledge/paths.js";
import { retrieve } from "../../knowledge/retrieve.js";
import type { KnowledgeCollection } from "../../knowledge/types.js";
import {
  createDocumentWithPlainText,
} from "../../lark/docx-document.js";
import { loadMemory, saveMemory, type MemoryStore } from "../../memory/store.js";

/** 内容创作检索：与对话 RAG 一致，不含 job_post */
const CONTENT_RAG_COLLECTIONS: KnowledgeCollection[] = [
  "platform_tone",
  "medical",
  "personal",
];

/** 第一跳：判断是否可成稿；若用户已授权编辑把握边界，应放行避免重复追问 */
const CLARIFICATION_GATE_SYSTEM = `你是医学新媒体编辑流程中的「动笔前核对」环节。判断：当前材料是否已足以**在合规前提下**撰写对外稿件（科普/营销类）。

**必须先识别用户是否已授权编辑**：若用户明确表示「由你/编辑决定剩余选项」「把握原则即可」「边界你看着办」「目的已说明清楚」「不必再追问」「可以动笔」等，且**受众、发布主体/场景、传播目的**已在对话中说清，则必须输出 \`GATE: READY\`，不得在可专业推断处继续追问。成稿时采用审慎表述：科普为主、避免处方药面向大众的推广式话术；具体合规细节由正文内保守处理，不占用闸门反复确认。

仅当**关键事实仍完全缺失**（例如完全未提受众或发布场景）或**用户明确要求你先问清**时，才使用 \`GATE: ASK\`（简短编号列表，最多 4 条）。

**输出格式（必须严格遵守）**：
- 第一行只能是：\`GATE: READY\` 或 \`GATE: ASK\`（不要加反引号、不要加 Markdown）。
- \`GATE: ASK\` 时：第二行起为编号追问；不要输出 \`GATE:\` 字样在正文里。
- \`GATE: READY\` 时：第一行后不要输出任何字符。

在「用户已授权 + 三要素已齐」与「仍缺关键信息」之间犹豫时，**倾向 \`GATE: READY\`**。`;

const GENERATION_SYSTEM = `你是医学新媒体编辑。根据用户任务、已确认的信息与知识库参考片段，撰写可直接对外使用的营销正文。
要求：
- 输出为纯文本，段落之间空一行；不要使用 Markdown 标题符号（如 #）。
- **只使用用户已确认的事实与知识库片段**；不得编造数据、病例、批文、疗效细节或产品信息；不确定处用审慎表述或删去，禁止杜撰补全。
- 医学表述审慎，不夸大疗效；遵守广告法，避免绝对化用语。
- 知识库片段仅供风格与事实参考；若与用户最新说明冲突，以用户为准。
- 只输出正文，不要开场白或后记说明；不要在正文里向读者列出「待确认」类运营问题（运营侧确认应在成稿前完成）。`;

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

/**
 * 上一轮助手是否在「追问需求」而未交付文档（用于合并后续补充说明并走 docx）。
 * 注意：不可匹配成功交付模板里的「补充要点」，否则会误把「已写好…链接…」当成仍在追问。
 */
export function assistantSeemedToAskWriteClarification(assistantText: string): boolean {
  const t = assistantText.slice(0, 1200);
  /** 已成功写入飞书 docx 的回复：后续用户句应走正常对话，禁止合并进写作任务 */
  if (
    /已写好并保存到飞书云文档|飞书云文档（新版 docx）/.test(t) &&
    /(链接：|https?:\/\/)/.test(t)
  ) {
    return false;
  }
  /** 仅失败/预览类交付仍可视作「待用户补充后再试」 */
  return /先确认|确认几个|动笔前需要先对齐|未确认前不会成稿|还需补充|请补充以下|补充说明(?!要点)|哪(几)?点|说清楚|方便告知|什么(受众|平台)|是否点名|写入.*失败|正文生成失败|—— 以下为生成正文预览/.test(
    t,
  );
}

/**
 * 当前用户句是否像「写作任务补充说明」，而非元对话/闲聊（避免与历史写作任务误合并）。
 */
export function isPlausibleWriteMergeFollowUp(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 6) return false;
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
    if (isContentCreateIntent(n)) {
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
      collections: CONTENT_RAG_COLLECTIONS,
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

function deriveDocumentTitle(userText: string): string {
  const t = userText.trim();
  const m = t.match(
    /(?:关于|写(?:一|篇|则)?(?:关于)?)[「《\s]*([^」》\n]{2,40}?)[」》\s]*(?:的)?(?:小红书|公众号|知乎|笔记|文章|文案|推文|帖子)/,
  );
  if (m?.[1]) return m[1].trim().slice(0, 80);
  const m2 = t.match(/《([^》]{2,40})》/);
  if (m2?.[1]) return m2[1].trim().slice(0, 80);
  return `内容稿件-${new Date().toISOString().slice(0, 10)}`;
}

function stripAssistantNoise(text: string): string {
  return text
    .replace(/^[\s\n]*(?:以下是|下面是|正文如下)[:：]?\s*/i, "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "").trim())
    .trim();
}

/**
 * 用户已说明受众/主体/目的，并授权编辑把握剩余边界时，跳过闸门，避免无限追问。
 */
function shouldSkipClarificationGate(userText: string): boolean {
  const t = normalizeUserTextForIntent(userText);
  if (t.length < 24) return false;

  const delegated =
    /(?:由你|你来)(?:定|判断|把握|决定)|你看着(?:办|定)|自己看着|把握原则|不必再追问|别再问|可以动笔|剩下的|授权|目的(?:已经|也已|都)?[^。]{0,12}明确|我知道你想|选项.*(?:由你|你来)|由你来定|你定就好|你把握|边界.*你|怎样好.*由你/.test(
      t,
    );
  const hasAudience =
    /受众|面向[^。，]{0,8}(?:大众|用户|患者|读者)|普通大众|目标受众|给患者|给大众|专业人士/.test(t);
  const hasPublisher =
    /发布主体|主体是|账号|署名|品牌方|良医汇|发布(?:方|账号)|小红书(?:笔记|账号)?/.test(t);
  const hasPurpose =
    /科普|传播|草稿|审核|宣传|目的|带着|产品/.test(t);

  return delegated && hasAudience && hasPublisher && hasPurpose;
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

/**
 * 检索 → **动笔前核对** →（仅 READY）生成 → 创建飞书云文档；ASK 时只回复追问，不创建文档。
 */
export async function runContentCreateWorkflow(
  _chatId: string,
  userText: string,
): Promise<string> {
  const memory = loadMemory();
  const ragBlock = await fetchRagContext(userText);
  const profileBlock = formatProfileBlock(memory);

  const userPayload = [
    "【用户任务】",
    userText.trim(),
    "",
    "【公司画像】",
    profileBlock,
    "",
    "【知识库参考】",
    ragBlock,
  ].join("\n");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  let gateReady = shouldSkipClarificationGate(userText);
  if (gateReady) {
    console.log(
      "[content-create] 用户已说明要素并授权编辑把握边界，跳过动笔前闸门，直接成稿",
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

    const gate = parseClarificationGateResponse(gateText);
    if (!gate.ready) {
      return [
        "动笔前需要先对齐下面几项，确认后我再撰写并写入飞书云文档（**未确认前不会成稿或杜撰**）：",
        "",
        gate.questions,
      ].join("\n");
    }
  }

  let body: string;
  try {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 4096,
      system: GENERATION_SYSTEM,
      messages: [{ role: "user", content: userPayload }],
    });
    body =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "";
    body = stripAssistantNoise(body);
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

  const title = deriveDocumentTitle(userText);
  const folderToken = process.env.FEISHU_DOC_FOLDER_TOKEN;

  try {
    const doc = await createDocumentWithPlainText(title, body, {
      folderToken: folderToken || undefined,
    });
    const fresh = loadMemory();
    fresh.lastDeliveredDoc = {
      documentId: doc.documentId,
      url: doc.url,
      title,
      createdAt: new Date().toISOString(),
    };
    saveMemory(fresh, { bumpInteraction: false });

    return [
      "已写好并保存到飞书云文档（新版 docx）。",
      `标题：${title}`,
      `链接：${doc.url}`,
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
