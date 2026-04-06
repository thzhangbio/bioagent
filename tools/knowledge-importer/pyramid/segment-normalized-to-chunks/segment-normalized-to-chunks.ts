import { chunkText } from "../../../../src/knowledge/chunk.js";
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

function classifyLiteratureSection(heading?: string): string {
  const normalized = (heading || "").toLowerCase();
  if (!normalized) return "front_matter";
  if (normalized.includes("abstract")) return "abstract";
  if (normalized.includes("introduction")) return "introduction";
  if (normalized.includes("result")) return "results";
  if (normalized.includes("discussion")) return "discussion";
  if (normalized.includes("method")) return "methods";
  if (normalized.includes("reference")) return "references";
  if (normalized.includes("declaration") || normalized.includes("conflict")) {
    return "declarations";
  }
  return "unknown";
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

  return flat.map(({ slot, text }, chunkIndex) => ({
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
