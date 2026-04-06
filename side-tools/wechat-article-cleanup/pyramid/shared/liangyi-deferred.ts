import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HEADER = `# 良医汇链接 — 自动搁置（尚未确立标杆范文时由抓取/清洗跳过）
# 格式：每条记录两行 —— 注释行含时间与 mp_name，下一行为 URL。勿删手动备注。
`;

/** 避免重复追加同一 URL */
export function appendLiangyiDeferred(
  root: string,
  url: string,
  mpName: string,
): void {
  const path = join(root, "links-liangyi-deferred.txt");
  if (existsSync(path)) {
    const prev = readFileSync(path, "utf-8");
    if (prev.split(/\r?\n/).some((l) => l.trim() === url.trim())) return;
  } else {
    appendFileSync(path, `${HEADER}\n`, "utf-8");
  }
  const stamp = new Date().toISOString();
  appendFileSync(
    path,
    `# ${stamp} mp_name=${mpName}\n${url.trim()}\n`,
    "utf-8",
  );
}
