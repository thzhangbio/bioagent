import { readFileSync } from "node:fs";
import { extname } from "node:path";

const TEXT_LIKE = new Set([".txt", ".md", ".markdown", ".json", ".csv"]);

export class UnsupportedExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedExtractError";
  }
}

/** MVP：仅从纯文本类文件抽取 UTF-8 正文（PDF/Word 等后续再接解析器） */
export function extractPlainTextFromFile(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (!TEXT_LIKE.has(ext)) {
    throw new UnsupportedExtractError(
      `暂不支持的类型 ${ext}，请先上传 .txt / .md（后续可扩展 PDF）`,
    );
  }
  return readFileSync(filePath, "utf-8");
}
