import { chunkText } from "../../../../src/knowledge/chunk.js";
import type { SectionPriority } from "../../../../src/knowledge/types.js";
import {
  idSafeKbWechatId,
  sanitizeWechatFileKey,
  segmentWechatBody,
  segmentsToChunkTexts,
} from "../segment-load-to-normalized/segment-load-to-normalized.wechat-shared.js";
import {
  appendKnowledgeImporterNote,
  type ImportChunkRecord,
  type ImportDocument,
  type KnowledgeImporterStage,
} from "../stage-shared.js";

interface LiteratureSection {
  sectionType: string;
  heading?: string;
  text: string;
}

interface LiteratureSectionPolicy {
  keep: boolean;
  priority: SectionPriority;
}

function classifyLiteratureSection(heading?: string): string {
  const normalized = (heading || "").toLowerCase();
  if (!normalized) return "front_matter";
  if (
    normalized.includes("pre-proof") ||
    normalized === "authors" ||
    normalized === "correspondence" ||
    normalized === "in brief"
  ) {
    return "front_matter";
  }
  if (normalized.includes("abstract")) return "abstract";
  if (normalized.includes("introduction")) return "introduction";
  if (normalized.includes("result")) return "results";
  if (normalized.includes("discussion")) return "discussion";
  if (normalized.includes("conclusion")) return "discussion";
  if (normalized.includes("method")) return "methods";
  if (normalized.includes("reference")) return "references";
  if (normalized.includes("declaration") || normalized.includes("conflict")) {
    return "declarations";
  }
  return "unknown";
}

function isLikelyPreproofFrontMatter(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    "journal pre-proof",
    "please cite this article",
    "sharing policy",
    "accepted manuscript",
    "version of record",
    "received date:",
    "accepted date:",
    "pii:",
    "to appear in:",
  ].some((marker) => normalized.includes(marker));
}

function resolveLiteratureSectionPolicy(section: LiteratureSection): LiteratureSectionPolicy {
  switch (section.sectionType) {
    case "abstract":
    case "results":
    case "discussion":
      return { keep: true, priority: "high" };
    case "introduction":
    case "methods":
    case "unknown":
      return { keep: true, priority: "normal" };
    case "references":
    case "declarations":
      return { keep: false, priority: "low" };
    case "front_matter":
      if (isLikelyPreproofFrontMatter(section.text) || section.text.trim().length < 400) {
        return { keep: false, priority: "low" };
      }
      return { keep: true, priority: "low" };
  }
}

function splitLiteratureSections(body: string): LiteratureSection[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections: LiteratureSection[] = [];
  let currentHeading: string | undefined;
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join("\n").trim();
    if (!text) return;
    sections.push({
      sectionType: classifyLiteratureSection(currentHeading),
      heading: currentHeading,
      text,
    });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1]!.trim();
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }

  flush();
  return sections;
}

function chunkLiteratureDocument(doc: ImportDocument): ImportChunkRecord[] {
  const sections = splitLiteratureSections(doc.body);
  const records: ImportChunkRecord[] = [];

  sections.forEach((section, sectionIndex) => {
    const policy = resolveLiteratureSectionPolicy(section);
    if (!policy.keep) {
      return;
    }
    const parts = chunkText(section.text, { chunkSize: 1200, overlap: 150 });
    parts.forEach((text, chunkIndex) => {
      const absoluteChunkIndex = records.length;
      records.push({
        id: `${doc.sourceId}__s${sectionIndex}__c${chunkIndex}`,
        source: doc.source,
        sourceId: doc.sourceId,
        collection: doc.collection,
        sourcePath: doc.sourcePath,
        sourceLabel: String(doc.metadata.sourceLabel || doc.title),
        chunkIndex: absoluteChunkIndex,
        text,
        metadata: {
          ...doc.metadata,
          sectionType: section.sectionType,
          sectionPriority: policy.priority,
          sectionHeading: section.heading,
          chunkStrategy: "literature-section-aware",
        },
      });
    });
  });

  return records;
}

function chunkWechatDocument(doc: ImportDocument): ImportChunkRecord[] {
  const variant = String(doc.metadata.wechatStyleVariant || "medsci");
  const kbWechatId = String(doc.metadata.kbWechatId || doc.sourceId);
  const fileKey = sanitizeWechatFileKey(doc.sourceId);
  const idPrefix = idSafeKbWechatId(kbWechatId);
  const segments = segmentWechatBody(doc.body);
  const flat = segmentsToChunkTexts(segments);

  return flat.map(({ slot, text, captionKind }, chunkIndex) => ({
    id: `wcs__${idPrefix}__${fileKey}__${slot}__c${chunkIndex}`,
    source: doc.source,
    sourceId: doc.sourceId,
    collection: doc.collection,
    sourcePath: doc.sourcePath,
    sourceLabel: String(doc.metadata.sourceLabel || doc.title),
    chunkIndex,
    text,
    metadata: {
      ...doc.metadata,
      wechatStyleVariant: variant,
      wechatContentSlot: slot,
      wechatCaptionKind: captionKind,
      kbWechatId,
      chunkStrategy: "wechat-slot-aware",
    },
  }));
}

function chunkPlainDocument(
  doc: ImportDocument,
  strategy: string,
  options?: Parameters<typeof chunkText>[1],
): ImportChunkRecord[] {
  return chunkText(doc.body, options).map((text, chunkIndex) => ({
    id: `${doc.sourceId}__c${chunkIndex}`,
    source: doc.source,
    sourceId: doc.sourceId,
    collection: doc.collection,
    sourcePath: doc.sourcePath,
    sourceLabel: String(doc.metadata.sourceLabel || doc.title),
    chunkIndex,
    text,
    metadata: {
      ...doc.metadata,
      chunkStrategy: strategy,
    },
  }));
}

function chunkDocument(doc: ImportDocument): ImportChunkRecord[] {
  switch (doc.source) {
    case "literature_kb":
      return chunkLiteratureDocument(doc);
    case "wechat_style":
      return chunkWechatDocument(doc);
    case "presets":
      return chunkPlainDocument(doc, "plain-window");
    case "job_posts":
      return chunkPlainDocument(doc, "plain-window");
  }
}

export const segmentNormalizedToChunksStage: KnowledgeImporterStage = {
  name: "segment-normalized-to-chunks",
  run(context) {
    const chunkRecords = context.documents.flatMap((doc) => chunkDocument(doc));
    return appendKnowledgeImporterNote(
      {
        ...context,
        chunkRecords,
        chunkRecordCount: chunkRecords.length,
      },
      `segment-normalized-to-chunks: built ${chunkRecords.length} chunk record(s) from ${context.documents.length} document(s).`,
    );
  },
};
