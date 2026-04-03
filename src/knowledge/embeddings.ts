import OpenAI from "openai";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

export function createEmbeddingClient(): OpenAI {
  return new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.apimart.ai/v1",
  });
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
}

/** 单次请求批量 embedding，保持输入顺序 */
export async function embedTexts(
  client: OpenAI,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getEmbeddingModel();
  const res = await client.embeddings.create({
    model,
    input: texts,
  });
  const sorted = [...res.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}
