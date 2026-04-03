import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface CompanyProfile {
  name?: string;
  products?: string;
  targetCustomers?: string;
  brandTone?: string;
  competitors?: string;
  notes?: string;
}

/** 最近一次「内容创作」工作流交付的云文档（供后续改稿等能力引用） */
export interface LastDeliveredDoc {
  documentId: string;
  url: string;
  title?: string;
  createdAt?: string;
}

export interface MemoryStore {
  companyProfile?: CompanyProfile;
  interactionCount: number;
  lastActiveAt?: string;
  lastDeliveredDoc?: LastDeliveredDoc;
}

const MEMORY_PATH = join(process.cwd(), "data", "memory.json");

export function loadMemory(): MemoryStore {
  try {
    if (existsSync(MEMORY_PATH)) {
      return JSON.parse(readFileSync(MEMORY_PATH, "utf-8"));
    }
  } catch (err) {
    console.warn("[memory] 读取失败，使用默认值:", err);
  }
  return { interactionCount: 0 };
}

export interface SaveMemoryOptions {
  /** 默认 true；仅更新字段（如 lastDeliveredDoc）时可设为 false，避免重复累加 interactionCount */
  bumpInteraction?: boolean;
}

export function saveMemory(
  memory: MemoryStore,
  options: SaveMemoryOptions = {},
): void {
  try {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    memory.lastActiveAt = new Date().toISOString();
    if (options.bumpInteraction !== false) {
      memory.interactionCount = (memory.interactionCount || 0) + 1;
    }
    writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), "utf-8");
  } catch (err) {
    console.error("[memory] 保存失败:", err);
  }
}
