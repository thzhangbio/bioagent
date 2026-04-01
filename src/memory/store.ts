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

export interface MemoryStore {
  companyProfile?: CompanyProfile;
  interactionCount: number;
  lastActiveAt?: string;
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

export function saveMemory(memory: MemoryStore): void {
  try {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    memory.lastActiveAt = new Date().toISOString();
    memory.interactionCount = (memory.interactionCount || 0) + 1;
    writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), "utf-8");
  } catch (err) {
    console.error("[memory] 保存失败:", err);
  }
}
