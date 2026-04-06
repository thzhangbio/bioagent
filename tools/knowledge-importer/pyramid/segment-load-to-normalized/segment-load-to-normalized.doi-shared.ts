const REGISTRY_DOI = /^(10\.\d{4,}\/.+)$/i;

export function normalizeDoi(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^doi:\s*/i, "");

  const fromUrl = s.match(
    /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^?\s#"'<>]+)/i,
  );
  if (fromUrl) {
    return stripTrailingJunk(decodeURIComponent(fromUrl[1]));
  }

  s = stripTrailingJunk(s);
  if (REGISTRY_DOI.test(s)) return s;

  return null;
}

function stripTrailingJunk(path: string): string {
  return path.replace(/[)\].,;]+$/g, "").replace(/\/+$/g, "");
}

export function looksLikeDoiString(s: string): boolean {
  return /^10\.\d{4,}\//i.test(s.trim());
}

export function extractFirstDoiFromMarkdown(md: string): string | null {
  const url = md.match(
    /https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s\])"'<>]+)/i,
  );
  if (url) return normalizeDoi(url[0]);

  const bare = md.match(/\b(10\.\d{4,}\/[^\s\])"'<>]+)/);
  if (bare) return normalizeDoi(bare[1]);

  return null;
}
