import { existsSync, readFileSync } from "node:fs";

import { createEmbeddingClient } from "../../knowledge/embeddings.js";
import { DEFAULT_RAG_STORE_PATH } from "../../knowledge/paths.js";
import { retrieve } from "../../knowledge/retrieve.js";
import type { SearchHit } from "../../knowledge/vector-file-store.js";

/** 与 content-create 一致，避免循环 import */
function normalizeUserTextForIntent(raw: string): string {
  let t = raw.trim();
  t = t.replace(/\u200b/g, "");
  t = t.replace(/<at[^>]*>([^<]*)<\/at>/gi, " ");
  t = t.replace(/@_user_[^\s@]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** 向量相似度下限（余弦）；低于此则尝试标签/题名包含关系 */
const LITERATURE_MIN_SCORE = 0.22;

/**
 * 固定句式：帮我把 … 这篇文献 … 仿梅斯学术 … 微信(公众)号 …
 * 抽取文献指向 XXX（题名关键词或《书名》）。
 */
export function parseMedsciLiteratureWechatRequest(
  raw: string,
): { literatureTopic: string } | null {
  const t = normalizeUserTextForIntent(raw);
  if (t.length < 12) return null;
  if (!/仿梅斯学术/.test(t)) return null;
  if (!/微信(?:公众)?号/.test(t)) return null;
  if (!/文献/.test(t)) return null;
  if (!/(?:请|麻烦)?帮我把/.test(t) && !/《[^》]+》/.test(t)) {
    return null;
  }

  const book = t.match(/《([^》\n]{2,120})》/);
  if (book?.[1]) {
    const literatureTopic = book[1].trim();
    if (literatureTopic.length >= 2) return { literatureTopic };
  }

  const m = t.match(/帮(?:我)?把\s*([\s\S]+?)\s*这篇文献/);
  if (m?.[1]) {
    let literatureTopic = m[1]
      .replace(/^[《「『]/u, "")
      .replace(/[》」』]$/u, "")
      .trim();
    literatureTopic = literatureTopic.replace(/\s+/g, " ").slice(0, 200);
    if (literatureTopic.length >= 2) return { literatureTopic };
  }

  return null;
}

function normalizeForIncludes(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。、；：""''「」《》]/g, "");
}

/**
 * 判断文献块是否与用户给出的主题相关（向量或题名包含）。
 */
function hitMatchesTopic(topic: string, hit: SearchHit): boolean {
  if (hit.score >= LITERATURE_MIN_SCORE) return true;
  const tn = normalizeForIncludes(topic);
  if (tn.length < 4) return false;
  const label = normalizeForIncludes(hit.chunk.sourceLabel || "");
  const path = normalizeForIncludes(hit.chunk.sourcePath || "");
  const paper = (hit.chunk.paperId || "").toLowerCase();
  if (tn.length >= 6 && (label.includes(tn.slice(0, 12)) || path.includes(tn.slice(0, 12)))) {
    return true;
  }
  const slice = tn.slice(0, Math.min(24, tn.length));
  if (label.includes(slice) || path.includes(slice)) return true;
  if (paper && tn.includes(paper.replace(/\s/g, ""))) return true;
  return hit.score >= 0.18 && (label.length > 0 || path.length > 0);
}

export interface VerifyLiteratureResult {
  ok: boolean;
  hits: SearchHit[];
}

interface LiteratureKbMetadata {
  title?: string;
  authors?: string;
  journal?: string;
  doi?: string;
  doiUrl?: string;
  published?: string;
}

/**
 * 在 literature 集合中检索并判定是否存在可对齐条目。
 */
export async function verifyLiteratureForMedsciWechat(
  literatureTopic: string,
): Promise<VerifyLiteratureResult> {
  const client = createEmbeddingClient();
  const hits = await retrieve(client, literatureTopic.trim(), {
    collections: ["literature"],
    topK: 12,
    storePath: DEFAULT_RAG_STORE_PATH,
  });
  if (hits.length === 0) return { ok: false, hits: [] };
  const matched = hits.filter((h) => hitMatchesTopic(literatureTopic, h));
  if (matched.length === 0) return { ok: false, hits: [] };
  return { ok: true, hits: matched };
}

function formatHitsBlock(hits: SearchHit[]): string {
  return hits
    .map(
      (h, i) =>
        `[#${i + 1} ${h.chunk.collection} | ${h.chunk.sourceLabel}]\n${h.chunk.text}`,
      )
    .join("\n\n---\n\n");
}

function parseLiteratureKbMetadataFromSourcePath(sourcePath: string): LiteratureKbMetadata | null {
  if (!sourcePath) return null;
  const absPath = sourcePath.startsWith("/") ?
      sourcePath
    : `${process.cwd()}/${sourcePath}`;
  if (!existsSync(absPath)) return null;
  try {
    const raw = readFileSync(absPath, "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m?.[1]) return null;
    const yaml = m[1];
    const pick = (key: string): string | undefined => {
      const mm = yaml.match(new RegExp(`^\\s{2}${key}:\\s*\"([^\"]*)\"`, "m"));
      return mm?.[1]?.trim() || undefined;
    };
    return {
      title: pick("title"),
      authors: pick("authors"),
      journal: pick("journal"),
      doi: pick("doi"),
      doiUrl: pick("doi_url"),
      published: pick("published"),
    };
  } catch {
    return null;
  }
}

function formatAuthorToken(name: string): string {
  const parts = name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1]!;
  const initials = parts
    .slice(0, -1)
    .map((p) =>
      p
        .replace(/[^A-Za-zÀ-ÿ-]/g, "")
        .split("-")
        .filter(Boolean)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join(""),
    )
    .join("");
  return initials ? `${last} ${initials}` : last;
}

function formatAuthorsVancouver(raw: string | undefined): string {
  if (!raw) return "";
  const authors = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(formatAuthorToken)
    .filter(Boolean);
  if (authors.length === 0) return "";
  if (authors.length <= 6) return authors.join(", ");
  return `${authors.slice(0, 6).join(", ")}, et al.`;
}

function formatPublishedDate(raw: string | undefined): string {
  if (!raw) return "";
  const m = raw.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return raw;
  const months = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const year = m[1];
  const month = m[2] ? months[Number(m[2])] : "";
  const day = m[3] ? String(Number(m[3])) : "";
  return [year, month, day].filter(Boolean).join(" ");
}

export function buildMedsciLiteratureReferences(
  literatureHits: SearchHit[],
): string {
  const primary = literatureHits[0]?.chunk;
  if (!primary) return "";
  const meta = parseLiteratureKbMetadataFromSourcePath(primary.sourcePath);
  const title = meta?.title || primary.sourceLabel || "";
  const authors = formatAuthorsVancouver(meta?.authors);
  const journal = meta?.journal?.trim() || "";
  const published = formatPublishedDate(meta?.published);
  const doi = meta?.doi?.trim() || primary.paperId || "";
  const doiUrl = meta?.doiUrl?.trim() || primary.sourceUrl || "";

  const line = [
    authors,
    title ? `${title}.` : "",
    journal ? `${journal}.` : "",
    published ? `${published}.` : "",
    doi ? `doi:${doi}.` : doiUrl ? `${doiUrl}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+\./g, ".")
    .trim();

  if (!line) return "";
  return ["参考资料：", `[1] ${line}`].join("\n\n");
}

export function stripGeneratedMedsciReferenceTail(body: string): string {
  let out = body.trim();
  out = out.replace(/\n+(?:---\n+)?(?:>\s*)?(?:\*\*)?文献来源[:：](?:\*\*)?[\s\S]*$/m, "");
  out = out.replace(/\n+(?:>\s*)?(?:\*\*)?参考资料[:：](?:\*\*)?[\s\S]*$/m, "");
  out = out.replace(/\n+\[\d+\][\s\S]*$/m, "");
  return out.trim();
}

/**
 * 文献事实块 + 梅斯学术（medsci）风格块，分段写入【知识库参考】。
 */
export async function fetchMedsciLiteratureRagContext(
  userText: string,
  literatureTopic: string,
  literatureHits: SearchHit[],
): Promise<string> {
  if (!process.env.OPENAI_API_KEY || !existsSync(DEFAULT_RAG_STORE_PATH)) {
    return "（当前无向量库或未配置 OPENAI_API_KEY，跳过检索。）";
  }
  try {
    const client = createEmbeddingClient();
    const litBlock =
      literatureHits.length > 0 ?
        formatHitsBlock(literatureHits.slice(0, 10))
      : "（文献无命中片段。）";

    const styleQuery = `${userText}\n仿梅斯学术 微信公众号 医学科普长文`.slice(0, 800);
    const styleHits = await retrieve(client, styleQuery, {
      collections: ["wechat_style"],
      wechatStyleVariants: ["medsci"],
      topK: 8,
      storePath: DEFAULT_RAG_STORE_PATH,
    });
    const styleBlock =
      styleHits.length > 0 ?
        styleHits
          .map(
            (h, i) =>
              `[#S${i + 1} ${h.chunk.collection} | ${h.chunk.sourceLabel}]\n${h.chunk.text}`,
          )
          .join("\n\n---\n\n")
      : "（梅斯风格库检索无命中片段。）";

    return [
      `【文献主题】${literatureTopic}`,
      "",
      "【以下为文献库事实参考（literature），正文数据与结论仅可据此与 user 任务表述，不得编造）】",
      litBlock,
      "",
      "【以下为梅斯学术风格参考（wechat_style / medsci），仅作标题节奏、段落与语气参考，不得当作事实来源】",
      styleBlock,
    ].join("\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[medsci-literature-wechat] RAG 检索失败:", msg);
    return `（检索失败：${msg.slice(0, 120)}）`;
  }
}
