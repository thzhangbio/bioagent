import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../prompts/medical-editor.js";
import { loadMemory, saveMemory, type CompanyProfile } from "../memory/store.js";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 30;

const conversations = new Map<string, ConversationMessage[]>();

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });
  }
  return client;
}

function getHistory(chatId: string): ConversationMessage[] {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }
  return conversations.get(chatId)!;
}

export async function handleUserMessage(
  chatId: string,
  userText: string
): Promise<string> {
  const history = getHistory(chatId);
  history.push({ role: "user", content: userText });

  if (history.length > MAX_HISTORY * 2) {
    history.splice(0, history.length - MAX_HISTORY * 2);
  }

  const memory = loadMemory();
  const profileText = memory.companyProfile
    ? formatProfile(memory.companyProfile)
    : undefined;

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const systemPrompt = buildSystemPrompt(profileText);

  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const assistantText =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "（无内容）";

    history.push({ role: "assistant", content: assistantText });

    extractAndSaveInfo(userText, memory);

    return assistantText;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent] Claude API 调用失败:", msg);

    history.pop();

    if (msg.includes("401") || msg.includes("auth")) {
      return "抱歉，我的身份凭证出了问题，请联系管理员检查 ANTHROPIC_API_KEY 配置。";
    }
    return "抱歉，我暂时处理不了这个请求，请稍后再试。";
  }
}

function formatProfile(p: CompanyProfile): string {
  const lines: string[] = [];
  if (p.name) lines.push(`- 公司名称：${p.name}`);
  if (p.products) lines.push(`- 主营产品/服务：${p.products}`);
  if (p.targetCustomers) lines.push(`- 目标客户：${p.targetCustomers}`);
  if (p.brandTone) lines.push(`- 品牌调性：${p.brandTone}`);
  if (p.competitors) lines.push(`- 竞品：${p.competitors}`);
  if (p.notes) lines.push(`- 补充信息：${p.notes}`);
  return lines.length > 0 ? lines.join("\n") : "已开始收集，信息暂不完整。";
}

function extractAndSaveInfo(
  userText: string,
  memory: ReturnType<typeof loadMemory>
): void {
  const profile = memory.companyProfile || ({} as CompanyProfile);
  let changed = false;

  const patterns: Array<{
    regex: RegExp;
    field: keyof CompanyProfile;
  }> = [
    { regex: /(?:我们?(?:公司)?(?:叫|是|名[叫称为]?)|公司名?[叫是称为])[\s:：]*(.{2,30})/, field: "name" },
    { regex: /(?:(?:主要|主营|核心)?(?:做|卖|经营|产品|服务)[的是]?)[\s:：]*(.{2,50})/, field: "products" },
    { regex: /(?:目标|针对|面向|客户|用户|人群)[的是]?[\s:：]*(.{2,50})/, field: "targetCustomers" },
    { regex: /(?:调性|风格|品牌|定位)[的是]?[\s:：]*(.{2,50})/, field: "brandTone" },
    { regex: /(?:竞品|竞争对手|同行)[的是有]?[\s:：]*(.{2,50})/, field: "competitors" },
  ];

  for (const { regex, field } of patterns) {
    if (!profile[field]) {
      const match = userText.match(regex);
      if (match?.[1]) {
        (profile as Record<string, string>)[field] = match[1].trim();
        changed = true;
      }
    }
  }

  if (changed) {
    memory.companyProfile = profile;
    saveMemory(memory);
    console.log("[agent] 公司画像已更新:", JSON.stringify(profile));
  }
}
