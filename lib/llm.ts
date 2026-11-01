import type { ChatMessage } from './types';

const DEFAULT_SYSTEM =
  '你是运行在小度智能音箱上的 AI 助手，请用简洁、口语化、适合朗读的中文回答，每次不超过200字。';

interface ChatCompletionChoice {
  message?: { content?: string | null };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

/**
 * 调用任意 OpenAI 兼容的 Chat Completions 接口。
 * 通过环境变量 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 切换模型（DeepSeek / 通义 / 豆包 / 自建）。
 */
export async function chat(history: ChatMessage[]): Promise<string> {
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const apiKey = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'deepseek-chat';
  const systemPrompt = process.env.LLM_SYSTEM_PROMPT || DEFAULT_SYSTEM;

  if (!apiKey) {
    return '模型未配置，请在环境变量中设置 LLM_API_KEY。';
  }

  const messages = [{ role: 'system', content: systemPrompt }, ...history];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || '抱歉，我暂时没有想好怎么回答。';
}
