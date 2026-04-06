import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  COLLECTION_MEDICAL,
  COLLECTION_PLATFORM_TONE,
} from "../../../../src/knowledge/collections.js";
import {
  extractFirstDoiFromMarkdown,
  looksLikeDoiString,
  normalizeDoi,
} from "./segment-load-to-normalized.doi-shared.js";
import {
  parseSimpleYamlFrontMatter,
  splitMarkdownFrontMatter,
} from "./segment-load-to-normalized.wechat-shared.js";
import {
  appendKnowledgeImporterNote,
  type ImportDocument,
  type KnowledgeImporterContext,
  type KnowledgeImporterStage,
} from "../stage-shared.js";

interface LiteratureMeta {
  paperId?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

function defaultInputPath(context: KnowledgeImporterContext): string | undefined {
  switch (context.source) {
    case "literature_kb": {
      const fromEnv = process.env.LITERATURE_INBOX?.trim();
      if (fromEnv) return resolve(context.options.cwd, fromEnv);
      return resolve(context.options.cwd, "data/knowledge/literature-inbox");
    }
    case "wechat_style": {
      const fromEnv = process.env.WECHAT_STYLE_INBOX?.trim();
      if (fromEnv) return resolve(context.options.cwd, fromEnv);
      return resolve(context.options.cwd, "side-tools/wechat-article-cleanup/out");
    }
    case "job_posts":
      return resolve(context.options.cwd, "research/医学编辑岗-苏州-整理");
    case "presets":
      return resolve(context.options.cwd, "rag-presets");
  }
}

function resolveInputPath(context: KnowledgeImporterContext): string | undefined {
  if (context.options.input?.trim()) {
    return resolve(context.options.cwd, context.options.input);
  }
  return defaultInputPath(context);
}

function buildSourceId(fileName: string): string {
  return fileName.replace(/\.md$/i, "");
}

function buildTitle(raw: string, fileName: string): string {
  const firstHeading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || fileName.replace(/\.md$/i, "");
}

function readJsonIfExists(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function loadLiteratureMeta(inputPath: string, baseName: string): LiteratureMeta | null {
  const raw = readJsonIfExists(join(inputPath, `${baseName}.meta.json`));
  if (!raw) return null;
  return {
    paperId: typeof raw.paperId === "string" ? raw.paperId : undefined,
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : undefined,
    sourceLabel: typeof raw.sourceLabel === "string" ? raw.sourceLabel : undefined,
  };
}

function parseLiteratureKbMetadata(raw: string): Record<string, string> {
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!block) return {};
  const yaml = block[1];
  const nested = yaml.match(/kb_metadata:\r?\n([\s\S]*)$/);
  if (!nested) return {};

  const lines: string[] = [];
  for (const line of nested[1]!.split(/\n/)) {
    if (/^[A-Za-z0-9_]+:/.test(line)) break;
    const m = line.match(/^\s{2}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    lines.push(`${m[1]}: ${m[2]}`);
  }
  return parseSimpleYamlFrontMatter(lines.join("\n"));
}

function resolveLiteratureSourceId(
  raw: string,
  meta: LiteratureMeta | null,
  kbMeta: Record<string, string>,
  fileBase: string,
): { sourceId: string; sourceUrl?: string; sourceLabel: string } {
  const metaSourceUrl = meta?.sourceUrl?.trim();
  const kbDoiUrl = kbMeta.doi_url?.trim();
  const kbDoi = kbMeta.doi?.trim();
  const metaPaperId = meta?.paperId?.trim();

  const fromUrl =
    (metaSourceUrl && normalizeDoi(metaSourceUrl)) ||
    (kbDoiUrl && normalizeDoi(kbDoiUrl));
  if (fromUrl) {
    return {
      sourceId: fromUrl,
      sourceUrl: `https://doi.org/${fromUrl}`,
      sourceLabel: meta?.sourceLabel || kbMeta.title || fileBase,
    };
  }

  if (kbDoi) {
    const normalized = normalizeDoi(kbDoi);
    if (normalized) {
      return {
        sourceId: normalized,
        sourceUrl: `https://doi.org/${normalized}`,
        sourceLabel: meta?.sourceLabel || kbMeta.title || fileBase,
      };
    }
  }

  if (metaPaperId && looksLikeDoiString(metaPaperId)) {
    const normalized = normalizeDoi(metaPaperId);
    if (normalized) {
      return {
        sourceId: normalized,
        sourceUrl: `https://doi.org/${normalized}`,
        sourceLabel: meta?.sourceLabel || kbMeta.title || fileBase,
      };
    }
  }

  const fromBody = extractFirstDoiFromMarkdown(raw);
  if (fromBody) {
    return {
      sourceId: fromBody,
      sourceUrl: `https://doi.org/${fromBody}`,
      sourceLabel: meta?.sourceLabel || kbMeta.title || fileBase,
    };
  }

  return {
    sourceId: metaPaperId || fileBase,
    sourceUrl: metaSourceUrl || kbDoiUrl,
    sourceLabel: meta?.sourceLabel || kbMeta.title || fileBase,
  };
}

function listMarkdownFiles(inputPath: string, matcher?: (file: string) => boolean): string[] {
  if (!existsSync(inputPath)) {
    throw new Error(`输入目录不存在: ${inputPath}`);
  }
  const files = readdirSync(inputPath)
    .filter(
      (file) =>
        file.endsWith(".md") &&
        file.toUpperCase() !== "README.MD" &&
        !file.startsWith(".") &&
        (matcher ? matcher(file) : true),
    )
    .sort();
  if (files.length === 0) {
    throw new Error(`输入目录下无可导入的 .md 文件: ${inputPath}`);
  }
  return files;
}

function loadLiteratureDocuments(context: KnowledgeImporterContext): ImportDocument[] {
  const inputPath = resolveInputPath(context);
  if (!inputPath) throw new Error("literature_kb 缺少输入目录");
  const files = listMarkdownFiles(inputPath, (file) => file.endsWith(".kb.md"));
  const docs = files.map((fileName) => {
    const sourcePath = resolve(inputPath, fileName);
    const raw = readFileSync(sourcePath, "utf-8");
    const baseName = basename(fileName, ".md");
    const meta = loadLiteratureMeta(inputPath, baseName);
    const kbMeta = parseLiteratureKbMetadata(raw);
    const resolved = resolveLiteratureSourceId(raw, meta, kbMeta, baseName);
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
    return {
      source: context.source,
      sourcePath,
      sourceId: resolved.sourceId,
      title: kbMeta.title || buildTitle(raw, fileName),
      collection: context.collection,
      body,
      metadata: {
        sourceUrl: resolved.sourceUrl,
        sourceLabel: resolved.sourceLabel,
        paperId: resolved.sourceId,
        doi: kbMeta.doi,
        journal: kbMeta.journal,
        published: kbMeta.published,
        abstract: kbMeta.abstract,
      },
    };
  });
  const deduped = new Map<string, ImportDocument>();
  for (const doc of docs) {
    deduped.set(doc.sourceId, doc);
  }
  return [...deduped.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

function resolveWechatVariant(front: Record<string, string>, sideMeta: Record<string, unknown> | null): string {
  const metaVariant =
    typeof sideMeta?.wechatStyleVariant === "string" ? sideMeta.wechatStyleVariant : undefined;
  const yamlVariant = front.wechat_style_variant?.trim();
  const envVariant = process.env.WECHAT_DEFAULT_VARIANT?.trim();
  return metaVariant || yamlVariant || envVariant || "medsci";
}

function resolveWechatStyleSource(
  front: Record<string, string>,
  sideMeta: Record<string, unknown> | null,
  variant: string,
): string {
  const metaSource =
    typeof sideMeta?.wechatStyleSource === "string" ? sideMeta.wechatStyleSource : undefined;
  const yamlSource = front.wechat_style_source?.trim();
  const legacySource = front.wechat_source_profile?.trim();
  return metaSource || yamlSource || legacySource || variant;
}

function resolveWechatStyleGenre(
  front: Record<string, string>,
  sideMeta: Record<string, unknown> | null,
): string {
  const metaGenre =
    typeof sideMeta?.wechatStyleGenre === "string" ? sideMeta.wechatStyleGenre : undefined;
  const yamlGenre = front.wechat_style_genre?.trim();
  const legacyGenre = front.wechat_article_category?.trim();
  return metaGenre || yamlGenre || legacyGenre || "generic_article";
}

function inferWechatStyleTask(genre: string): string {
  switch (genre) {
    case "literature_digest":
      return "literature_to_wechat";
    case "clinical_news":
      return "news_to_wechat";
    case "conference_news":
      return "conference_to_wechat";
    case "expert_viewpoint":
      return "commentary_to_wechat";
    case "activity_promo":
    case "recruitment_or_course":
      return "promo_to_wechat";
    case "roundup":
      return "roundup_to_wechat";
    default:
      return "generic_to_wechat";
  }
}

function resolveWechatStyleTask(
  front: Record<string, string>,
  sideMeta: Record<string, unknown> | null,
  genre: string,
): string {
  const metaTask =
    typeof sideMeta?.wechatStyleTask === "string" ? sideMeta.wechatStyleTask : undefined;
  const yamlTask = front.wechat_style_task?.trim();
  return metaTask || yamlTask || inferWechatStyleTask(genre);
}

function loadWechatDocuments(context: KnowledgeImporterContext): ImportDocument[] {
  const inputPath = resolveInputPath(context);
  if (!inputPath) throw new Error("wechat_style 缺少输入目录");
  const files = listMarkdownFiles(inputPath);
  return files.map((fileName) => {
    const sourcePath = resolve(inputPath, fileName);
    const raw = readFileSync(sourcePath, "utf-8");
    const baseName = basename(fileName, ".md");
    const sideMeta = readJsonIfExists(join(inputPath, `${baseName}.meta.json`));
    const { front, body } = splitMarkdownFrontMatter(raw);
    const sourceId = (front.kb_wechat_id || buildSourceId(fileName)).replace(/^"|"$/g, "");
    const title = (front.title || buildTitle(raw, fileName)).replace(/^"|"$/g, "");
    const wechatStyleVariant = resolveWechatVariant(front, sideMeta);
    const wechatStyleSource = resolveWechatStyleSource(front, sideMeta, wechatStyleVariant);
    const wechatStyleGenre = resolveWechatStyleGenre(front, sideMeta);
    const wechatStyleTask = resolveWechatStyleTask(front, sideMeta, wechatStyleGenre);
    return {
      source: context.source,
      sourcePath,
      sourceId,
      title,
      collection: context.collection,
      body,
      metadata: {
        sourceLabel: title,
        kbWechatId: sourceId,
        wechatStyleVariant,
        wechatStyleSource,
        wechatStyleGenre,
        wechatStyleTask,
        mpName: front.mp_name?.replace(/^"|"$/g, ""),
        publishedAt: front.published_at,
        url: front.url,
      },
    };
  });
}

function loadPresetDocuments(context: KnowledgeImporterContext): ImportDocument[] {
  const inputPath = resolveInputPath(context);
  if (!inputPath) throw new Error("presets 缺少输入目录");
  const files = [
    {
      fileName: "platform-tone.md",
      collection: COLLECTION_PLATFORM_TONE,
      title: "平台调性（预置）",
    },
    {
      fileName: "medical-compliance.md",
      collection: COLLECTION_MEDICAL,
      title: "医学与合规（预置）",
    },
  ];
  return files.map((item) => {
    const sourcePath = resolve(inputPath, item.fileName);
    if (!existsSync(sourcePath)) {
      throw new Error(`缺少预置文件: ${sourcePath}`);
    }
    return {
      source: context.source,
      sourcePath,
      sourceId: basename(item.fileName, ".md"),
      title: item.title,
      collection: item.collection,
      body: readFileSync(sourcePath, "utf-8").trim(),
      metadata: {
        sourceLabel: item.title,
      },
    };
  });
}

function loadJobPostDocuments(context: KnowledgeImporterContext): ImportDocument[] {
  const inputPath = resolveInputPath(context);
  if (!inputPath) throw new Error("job_posts 缺少输入目录");
  const files = listMarkdownFiles(inputPath, (file) => /^\d{2}-.+\.md$/.test(file));
  return files.map((fileName) => {
    const sourcePath = resolve(inputPath, fileName);
    const title = basename(fileName, ".md").replace(/^\d{2}-/, "");
    return {
      source: context.source,
      sourcePath,
      sourceId: basename(fileName, ".md"),
      title,
      collection: context.collection,
      body: readFileSync(sourcePath, "utf-8").trim(),
      metadata: {
        sourceLabel: title,
      },
    };
  });
}

function loadDocuments(context: KnowledgeImporterContext): ImportDocument[] {
  switch (context.source) {
    case "literature_kb":
      return loadLiteratureDocuments(context);
    case "wechat_style":
      return loadWechatDocuments(context);
    case "presets":
      return loadPresetDocuments(context);
    case "job_posts":
      return loadJobPostDocuments(context);
  }
}

export const segmentLoadToNormalizedStage: KnowledgeImporterStage = {
  name: "segment-load-to-normalized",
  run(context) {
    const inputPath = resolveInputPath(context);
    const documents = loadDocuments(context);
    return appendKnowledgeImporterNote(
      {
        ...context,
        inputPath,
        documents,
        normalizedDocumentCount: documents.length,
      },
      `segment-load-to-normalized: loaded ${documents.length} document(s) for source ${context.source}${inputPath ? ` from ${inputPath}` : ""}.`,
    );
  },
};
