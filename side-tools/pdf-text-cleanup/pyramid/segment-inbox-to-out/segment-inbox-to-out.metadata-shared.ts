/**
 * 知识库终稿：归一化 YAML 元数据头。
 * 流程：① 正文启发式抽取；② DOI 请求 Crossref；③ 无摘要时 fallback Europe PMC；④ 合并为终稿元数据（仅一份，不写冗长审计块以免污染向量库）。
 */

import {
  doiSegmentToDoi,
  extractDoiSegmentFromArchiveBasename,
  extractPrimaryDoiFromMarkdown,
} from "./segment-inbox-to-out.archive-name-shared.js";

export interface KbArticleMetadata {
  title: string;
  authors: string;
  journal: string;
  doi: string;
  /** https://doi.org/… */
  doiUrl: string;
  /** YYYY-MM-DD，未知则为空串 */
  published: string;
  abstract: string;
}

/** 终稿字段来源：正文 text / Crossref 校正 crossref / 无 none */
export interface KbMetadataProvenance {
  title: "text" | "crossref" | "none";
  authors: "text" | "crossref" | "none";
  journal: "text" | "crossref" | "none";
  doi: "text" | "crossref" | "filename" | "none";
  published: "text" | "crossref" | "none";
  abstract: "text" | "crossref" | "europepmc" | "none";
}

export interface KbCrossrefQueryInfo {
  /** 是否发起过 HTTP 请求（--no-crossref 时为 false） */
  queried: boolean;
  /** 请求成功且解析到至少一项元数据 */
  ok: boolean;
  /** 查询使用的 DOI */
  doi?: string;
}

export interface EnrichKbMetadataOptions {
  /** 若正文无 DOI，可用归档文件名中的段（如 10.1038_…）还原 */
  doiFallbackFromBasename?: string;
  /** 为 false 时不请求网络，仅用本地抽取 + DOI 规范化 */
  fetchCrossref?: boolean;
  /** Crossref polite pool：建议设置邮箱，如 process.env.CROSSREF_MAILTO */
  mailto?: string;
  fetchTimeoutMs?: number;
  /**
   * Crossref 未返回合格摘要时，是否用 Europe PMC REST API 按 DOI 补摘要（默认 true）。
   */
  fetchEuropePmc?: boolean;
  /**
   * 为 true（默认）时，在 kb_metadata 已有对应字段的前提下，从正文删除重复的标题、期刊/DOI 行、
   * 收稿/上线日期行及 `# Abstract` / `# Summary` 整段，避免与 YAML 双份并存。
   */
  stripDuplicateMetadataInBody?: boolean;
}

const PLACEHOLDER_DATE = /^(xx\s+xx\s+xxxx|yyyy-mm-dd|\?\?\?)/i;

function isBlank(s: string | undefined): boolean {
  return !s || !String(s).trim();
}

function stripInlineDoiFromTitle(line: string): string {
  return line
    .replace(/\s*https?:\/\/doi\.org\/\S+/gi, "")
    .replace(/\s*doi:\s*10\.\S+/gi, "")
    .trim();
}

/** 去掉 MinerU 结构块后的正文起始，用于抽取 */
function kbBodyForExtraction(md: string): string {
  const m = md.match(
    /^##\s*文档结构（MinerU JSON，版面顺序）[\s\S]*?\n---\s*\n+/,
  );
  return m ? md.slice(m[0].length) : md;
}

/**
 * 从终稿 Markdown 启发式抽取元数据（不完整时由 Crossref 补）。
 */
export function extractMetadataFromKbMarkdown(md: string): Partial<KbArticleMetadata> {
  const body = kbBodyForExtraction(md);
  const lines = body.split("\n");
  const out: Partial<KbArticleMetadata> = {};

  const titleLine = lines.find((l) => /^#\s+/.test(l));
  if (titleLine) {
    let t = titleLine.replace(/^#\s+/, "").trim();
    t = stripInlineDoiFromTitle(t);
    if (t.length >= 3) out.title = t;
  }

  const doiFromText = extractPrimaryDoiFromMarkdown(md);
  if (doiFromText) {
    out.doi = doiFromText.toLowerCase();
    out.doiUrl = `https://doi.org/${out.doi}`;
  }

  // 期刊行：常见 "Journal Name; https://doi.org/10...."
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (!line.includes("doi.org") && !/^doi:\s*10\./i.test(line)) continue;
    if (line.includes(";")) {
      const left = line.split(";")[0].trim();
      if (left.length >= 2 && left.length < 300 && !/^#/.test(left)) {
        out.journal = left;
        break;
      }
    }
  }

  // 接收/发表日期行：Received: … Published online: 03 April 2026
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i];
    const pub = line.match(
      /Published\s+online:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i,
    );
    if (pub) {
      const day = pub[1].padStart(2, "0");
      const month = monthNameToNum(pub[2]);
      const year = pub[3];
      if (month) out.published = `${year}-${month}-${day}`;
      break;
    }
    const iso = line.match(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      out.published = `${iso[1]}-${iso[2]}-${iso[3]}`;
      break;
    }
  }

  const absSec = extractAbstractSection(body);
  if (absSec && absSec.length > 80) out.abstract = absSec;

  return out;
}

/**
 * 抽取摘要正文：支持 `# Abstract` 以及 Elsevier/eBioMedicine 常用的 `# Summary`。
 * 在 `Copyright` / `Keywords:` / 下一主节标题（如 Research in context、Introduction）前结束，避免并入页脚。
 */
function extractAbstractSection(md: string): string | undefined {
  const m = md.match(
    /^#+\s*(?:Abstract|Summary)\s*\n+([\s\S]*?)(?=^Copyright\b|^Keywords:\s|^\n*#+\s*(?:Research in context|Introduction|INTRODUCTION)\b|\Z)/im,
  );
  if (!m) return undefined;
  let t = m[1].trim();
  t = t.replace(/^(?:abstract|summary)\s*[:\s]*/i, "");
  return normalizeWhitespace(t);
}

function monthNameToNum(name: string): string | null {
  const map: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const k = name.toLowerCase();
  return map[k] ?? null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 对比用：弱化标点与空白差异 */
function normalizeForCompare(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""''`´]/g, "")
    .replace(/[^\p{L}\p{N}\s;:/.-]/gu, "")
    .trim();
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}

interface CrossrefDatePart {
  "date-parts"?: number[][];
}

interface CrossrefMessage {
  title?: string[];
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  abstract?: string;
  DOI?: string;
  "published-print"?: CrossrefDatePart;
  "published-online"?: CrossrefDatePart;
  published?: CrossrefDatePart;
}

interface CrossrefWorksResponse {
  message?: CrossrefMessage;
}

function stripJatsAbstract(raw: string): string {
  let s = raw.replace(/<\/jats:p>/gi, "\n").replace(/<jats:p[^>]*>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  return normalizeWhitespace(s);
}

function formatAuthorsFromCrossref(authors: CrossrefAuthor[] | undefined): string {
  if (!authors?.length) return "";
  const parts: string[] = [];
  for (const a of authors) {
    if (a.name) {
      parts.push(a.name.trim());
      continue;
    }
    const g = (a.given ?? "").trim();
    const f = (a.family ?? "").trim();
    if (f && g) parts.push(`${g} ${f}`);
    else if (f) parts.push(f);
    else if (g) parts.push(g);
  }
  return parts.join("; ");
}

function datePartsToIso(
  container: CrossrefDatePart | undefined,
): string {
  const parts = container?.["date-parts"]?.[0];
  if (!parts?.length) return "";
  const y = parts[0];
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  if (!y) return "";
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export async function fetchCrossrefMetadata(
  doi: string,
  options: { mailto?: string; timeoutMs?: number } = {},
): Promise<Partial<KbArticleMetadata>> {
  const encoded = encodeURIComponent(doi);
  const mailto = options.mailto ?? process.env.CROSSREF_MAILTO ?? "unknown@example.org";
  const url = `https://api.crossref.org/works/${encoded}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 18_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": `bioagent-pdf-kb-pipeline/0.1 (mailto:${mailto})`,
      },
    });
    if (!res.ok) return {};
    const json = (await res.json()) as CrossrefWorksResponse;
    const msg = json.message;
    if (!msg) return {};

    const out: Partial<KbArticleMetadata> = {};
    const title = msg.title?.[0]?.trim();
    if (title) out.title = title;

    const authors = formatAuthorsFromCrossref(msg.author);
    if (authors) out.authors = authors;

    const journal = msg["container-title"]?.[0]?.trim();
    if (journal) out.journal = journal;

    if (msg.DOI) {
      out.doi = msg.DOI.toLowerCase();
      out.doiUrl = `https://doi.org/${out.doi}`;
    }

    const iso =
      datePartsToIso(msg["published-print"]) ||
      datePartsToIso(msg["published-online"]) ||
      datePartsToIso(msg.published);
    if (iso) out.published = iso;

    if (msg.abstract) {
      const abs = stripJatsAbstract(msg.abstract);
      if (abs.length > 40) out.abstract = abs;
    }

    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

interface EuropePmcSearchResponse {
  resultList?: {
    result?: Array<{ abstractText?: string }>;
  };
}

/**
 * Europe PMC：`search` 按 `DOI:10.xxx/...` 查询，取首条 `abstractText`。
 * @see https://europepmc.org/RestfulWebService
 */
export async function fetchEuropePmcAbstractByDoi(
  doi: string,
  options: { timeoutMs?: number; mailto?: string } = {},
): Promise<string | null> {
  const q = encodeURIComponent(`DOI:${doi.trim()}`);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&resultType=core&pageSize=1`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 15_000);
  const mailto =
    options.mailto ?? process.env.CROSSREF_MAILTO ?? "unknown@example.org";
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": `bioagent-pdf-kb-pipeline/0.1 (mailto:${mailto})`,
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EuropePmcSearchResponse;
    const hit = json.resultList?.result?.[0];
    const raw = hit?.abstractText?.trim();
    if (!raw || raw.length < 40) return null;
    return normalizeWhitespace(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function abstractLooksBad(s: string): boolean {
  return s.length < 80;
}

function publishedLooksBad(s: string): boolean {
  if (isBlank(s)) return true;
  if (PLACEHOLDER_DATE.test(s.trim())) return true;
  return false;
}

/** 终稿字段若与 Crossref 返回值一致则标为 crossref，否则为 text */
function fieldProvenance(
  final: string,
  rem: string,
  useRemote: boolean,
): "text" | "crossref" | "none" {
  if (!final.trim()) return "none";
  if (useRemote && rem.trim() && final.trim() === rem.trim()) return "crossref";
  return "text";
}

function abstractFieldProvenance(
  final: string,
  crossrefAbs: string,
  epmcAbs: string,
): "text" | "crossref" | "europepmc" | "none" {
  const f = final.trim();
  if (!f) return "none";
  const cr = crossrefAbs.trim();
  const ep = epmcAbs.trim();
  if (cr && f === cr) return "crossref";
  if (ep && f === ep) return "europepmc";
  return "text";
}

/**
 * 本地抽取完成后，用 Crossref / Europe PMC 对比校正：注册表有值则以注册表为准。
 * 不写「before/after」审计正文，避免与 `abstract` 等重复灌入向量库。
 */
export function mergeKbMetadataWithCrossrefCorrection(
  local: Partial<KbArticleMetadata>,
  crossref: Partial<KbArticleMetadata>,
  doiResolved: string | null,
  crossrefQuery: KbCrossrefQueryInfo,
  europepmcAbstract = "",
): {
  meta: KbArticleMetadata;
  provenance: KbMetadataProvenance;
} {
  const useRemote = crossrefQuery.ok;

  const locTitle = local.title?.trim() ?? "";
  const locAuthors = local.authors?.trim() ?? "";
  const locJournal = local.journal?.trim() ?? "";
  const locPublished = local.published?.trim() ?? "";
  const locAbstract = local.abstract?.trim() ?? "";
  const locDoi = local.doi?.trim().toLowerCase() ?? "";
  const remTitle = crossref.title?.trim() ?? "";
  const remAuthors = crossref.authors?.trim() ?? "";
  const remJournal = crossref.journal?.trim() ?? "";
  const remPublished = crossref.published?.trim() ?? "";
  const remAbstract = crossref.abstract?.trim() ?? "";
  const epmcAbs = europepmcAbstract.trim();
  const remDoi = crossref.doi?.trim().toLowerCase() ?? "";

  let title = locTitle;
  let authors = locAuthors;
  let journal = locJournal;
  let published = locPublished;
  let abstract = locAbstract;

  if (useRemote && remTitle) {
    title = remTitle;
  }

  if (useRemote && remAuthors) {
    authors = remAuthors;
  }

  if (useRemote && remJournal) {
    journal = remJournal;
  }

  if (useRemote && remPublished) {
    published = remPublished;
  }

  if (useRemote && remAbstract && !abstractLooksBad(remAbstract)) {
    abstract = remAbstract;
  } else if (epmcAbs && !abstractLooksBad(epmcAbs)) {
    abstract = epmcAbs;
  }

  /** DOI：注册数据优先 */
  let doi = "";
  let doiProv: KbMetadataProvenance["doi"] = "none";
  if (useRemote && remDoi) {
    doi = remDoi;
    doiProv = "crossref";
  } else if (locDoi) {
    doi = locDoi;
    doiProv = "text";
  } else if (doiResolved?.trim()) {
    doi = doiResolved.trim().toLowerCase();
    doiProv = "filename";
  }

  const doiUrl = doi ? `https://doi.org/${doi}` : "";

  const provenance: KbMetadataProvenance = {
    title: fieldProvenance(title, remTitle, useRemote),
    authors: fieldProvenance(authors, remAuthors, useRemote),
    journal: fieldProvenance(journal, remJournal, useRemote),
    published: fieldProvenance(published, remPublished, useRemote),
    abstract: abstractFieldProvenance(abstract, remAbstract, epmcAbs),
    doi: doiProv,
  };

  const meta: KbArticleMetadata = {
    title,
    authors,
    journal,
    doi,
    doiUrl,
    published,
    abstract,
  };

  return { meta, provenance };
}

/** JSON 兼容 YAML 1.2 的标量字符串 */
function yamlJsonString(s: string): string {
  return JSON.stringify(s ?? "");
}

/**
 * 生成面向知识库/向量化的精简 YAML front matter：每字段仅一份终值 + `provenance` 标明来源。
 */
export function formatKbYamlFrontMatter(
  meta: KbArticleMetadata,
  provenance: KbMetadataProvenance,
): string {
  const lines: string[] = ["---", "kb_metadata:"];
  const indent = "  ";
  lines.push(`${indent}title: ${yamlJsonString(meta.title)}`);
  lines.push(`${indent}authors: ${yamlJsonString(meta.authors)}`);
  lines.push(`${indent}journal: ${yamlJsonString(meta.journal)}`);
  lines.push(`${indent}doi: ${yamlJsonString(meta.doi)}`);
  lines.push(`${indent}doi_url: ${yamlJsonString(meta.doiUrl)}`);
  lines.push(`${indent}published: ${yamlJsonString(meta.published)}`);
  lines.push(`${indent}abstract: ${yamlJsonString(meta.abstract)}`);
  lines.push(`${indent}provenance:`);
  lines.push(`${indent}  title: ${provenance.title}`);
  lines.push(`${indent}  authors: ${provenance.authors}`);
  lines.push(`${indent}  journal: ${provenance.journal}`);
  lines.push(`${indent}  doi: ${provenance.doi}`);
  lines.push(`${indent}  published: ${provenance.published}`);
  lines.push(`${indent}  abstract: ${provenance.abstract}`);
  lines.push("---");
  return lines.join("\n");
}

/** 与 {@link extractAbstractSection} 边界一致，用于整段删除 */
const ABSTRACT_OR_SUMMARY_BLOCK_RE =
  /^#+\s*(?:Abstract|Summary)\s*\n+[\s\S]*?(?=^Copyright\b|^Keywords:\s|^\n*#+\s*(?:Research in context|Introduction|INTRODUCTION)\b|\Z)/im;

function stripFirstTitleLineIfMatchesMeta(md: string, title: string): string {
  if (!title.trim()) return md;
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return md;
  const m = lines[i].match(/^#\s+(.+)$/);
  if (!m) return md;
  const raw = stripInlineDoiFromTitle(m[1]);
  if (normalizeForCompare(raw) !== normalizeForCompare(title)) return md;
  lines.splice(i, 1);
  return lines.join("\n").replace(/^\n+/, "");
}

const MAX_HEAD_SCAN_FOR_BIB_STRIP = 48;
/** 过长行视为正文，不当作元数据行删除 */
const MAX_BIB_STRIP_LINE_LEN = 900;

function shouldRemoveBibliographicLine(
  t: string,
  meta: KbArticleMetadata,
): boolean {
  if (t.length > MAX_BIB_STRIP_LINE_LEN) return false;
  if (t.startsWith("#")) return false;

  if (
    meta.published &&
    (/^(Received:|Revised:|Accepted:)/i.test(t) ||
      /^Published\s+online:/i.test(t))
  ) {
    return true;
  }

  if (
    meta.doi &&
    /^https?:\/\/doi\.org\/\S+\s*$/i.test(t)
  ) {
    const path = t
      .replace(/^https?:\/\/doi\.org\//i, "")
      .replace(/[.,;:)]+$/, "")
      .toLowerCase();
    if (path === meta.doi.toLowerCase()) return true;
  }

  if (
    meta.journal &&
    meta.doi &&
    t.includes(";") &&
    /doi\.org/i.test(t)
  ) {
    const left = t.split(";")[0].trim();
    if (left.length >= 2) {
      const jm = normalizeForCompare(meta.journal);
      const jl = normalizeForCompare(left);
      if (
        jm.length >= 6 &&
        (jl === jm ||
          jl.includes(jm.slice(0, Math.min(14, jm.length))) ||
          jm.includes(jl.slice(0, Math.min(14, jl.length))))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 在正文前若干行内删除与元数据重复的期刊/DOI 行、日期行（不限于文首第一行）。
 */
function stripBibliographicDuplicatesInHead(
  md: string,
  meta: KbArticleMetadata,
): string {
  const lines = md.split("\n");
  const n = Math.min(lines.length, MAX_HEAD_SCAN_FOR_BIB_STRIP);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i < n && shouldRemoveBibliographicLine(lines[i].trim(), meta)) {
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

/**
 * `kb_metadata` 已写入后，从正文去掉与元数据重复的块与文首行（字段非空才删对应部分）。
 */
export function stripKbBodyMetadataDuplicates(
  md: string,
  meta: KbArticleMetadata,
): string {
  let text = md.replace(/\r\n/g, "\n");

  if (meta.abstract?.trim()) {
    text = text.replace(ABSTRACT_OR_SUMMARY_BLOCK_RE, "");
    text = text.replace(/\n{3,}/g, "\n\n");
  }

  if (meta.title?.trim()) {
    text = stripFirstTitleLineIfMatchesMeta(text, meta.title);
  }

  text = stripBibliographicDuplicatesInHead(text, meta);

  return text.trim() + "\n";
}

/** 若已有同类 front matter，移除以免重复 */
function stripExistingKbFrontMatter(md: string): string {
  if (!md.startsWith("---\n")) return md;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return md;
  const block = md.slice(0, end + 5);
  if (!block.includes("kb_metadata:")) return md;
  return md.slice(end + 5).replace(/^\n+/, "");
}

/**
 * 在终稿顶部插入归一化元数据 YAML；`md` 为 `cleanMarkdownForKnowledgeBase` 的输出。
 */
export async function prependNormalizedKbMetadata(
  md: string,
  options: EnrichKbMetadataOptions = {},
): Promise<string> {
  const body = stripExistingKbFrontMatter(md);
  const local = extractMetadataFromKbMarkdown(body);

  let doiResolved: string | null = local.doi ?? null;
  if (!doiResolved && options.doiFallbackFromBasename) {
    const seg =
      extractDoiSegmentFromArchiveBasename(options.doiFallbackFromBasename) ??
      (/^10\.[0-9]+_/.test(options.doiFallbackFromBasename)
        ? options.doiFallbackFromBasename
        : null);
    if (seg) doiResolved = doiSegmentToDoi(seg);
  }

  const doiForFetch = local.doi || doiResolved;
  let cross: Partial<KbArticleMetadata> = {};
  const queried = options.fetchCrossref !== false && !!doiForFetch;
  if (queried) {
    cross = await fetchCrossrefMetadata(doiForFetch, {
      mailto: options.mailto,
      timeoutMs: options.fetchTimeoutMs,
    });
  }

  const crossrefOk =
    queried &&
    !!(
      cross.doi ||
      cross.title ||
      cross.journal ||
      cross.authors ||
      cross.published ||
      cross.abstract
    );

  const crossrefQuery: KbCrossrefQueryInfo = {
    queried,
    ok: crossrefOk,
    doi: doiForFetch ?? undefined,
  };

  let epmcAbstract = "";
  const crossrefHasGoodAbstract =
    !!(cross.abstract?.trim()) && !abstractLooksBad(cross.abstract.trim());
  if (
    options.fetchEuropePmc !== false &&
    doiForFetch &&
    !crossrefHasGoodAbstract
  ) {
    const e = await fetchEuropePmcAbstractByDoi(doiForFetch, {
      timeoutMs: options.fetchTimeoutMs,
      mailto: options.mailto,
    });
    if (e) epmcAbstract = e;
  }

  const { meta, provenance } = mergeKbMetadataWithCrossrefCorrection(
    local,
    cross,
    doiResolved,
    crossrefQuery,
    epmcAbstract,
  );
  const header = formatKbYamlFrontMatter(meta, provenance);

  let bodyOut = body.trimStart();
  if (options.stripDuplicateMetadataInBody !== false) {
    bodyOut = stripKbBodyMetadataDuplicates(bodyOut, meta);
  }

  return `${header}\n${bodyOut}`;
}
