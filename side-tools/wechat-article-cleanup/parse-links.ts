/** 解析 `links.txt`：每行一条 URL；`#` 开头为注释；忽略空行 */

export function parseLinksFile(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const url = t.split(/\s+/)[0]!;
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
