import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestSignature } from '../../../lib/verifySignature';
import { chat } from '../../../lib/llm';
import { buildDuerResponse } from '../../../lib/response';
import type { DuerOSRequest, ChatMessage, SkillSessionAttributes } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 健康检查探活：平台默认用 GET 探 /api/dueros，返回 200 即可，不影响小度 POST 请求
export async function GET() {
  return new NextResponse('ok', { status: 200 });
}

const MAX_HISTORY = 20; // 双向各保留最近 20 条，避免超出 24KB 响应上限

const WELCOME = '已接入新的 AI 模型，有什么可以帮你？';
const NOT_HEARD = '没听清，请再说一遍？';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 1) 签名校验（本地调试可用 DEBUG_SKIP_SIGNATURE=1 跳过）
  const skip = process.env.DEBUG_SKIP_SIGNATURE === '1';
  if (!skip) {
    const signature = req.headers.get('signature') || undefined;
    const certUrl = req.headers.get('signaturecerturl') || undefined;
    const ok = await verifyRequestSignature(rawBody, signature, certUrl);
    if (!ok) {
      return new NextResponse('Invalid signature', { status: 401 });
    }
  }

  // 2) 解析请求
  let data: DuerOSRequest;
  try {
    data = JSON.parse(rawBody) as DuerOSRequest;
  } catch {
    return new NextResponse('Bad JSON', { status: 400 });
  }

  const sessionAttributes: SkillSessionAttributes = data.session?.attributes || {};

  // 3) 处理各类请求
  if (data.request.type === 'LaunchRequest') {
    return NextResponse.json(buildDuerResponse({ text: WELCOME, shouldEndSession: false, sessionAttributes, expectSpeech: true }));
  }

  if (data.request.type === 'SessionEndedRequest') {
    return NextResponse.json({
      version: '2.0',
      session: { attributes: {} },
      response: { shouldEndSession: true },
    });
  }

  // IntentRequest：取用户原话
  const userText =
    data.request.query?.original || data.request.query?.rewritten || '';
  if (!userText.trim()) {
    return NextResponse.json(buildDuerResponse({ text: NOT_HEARD, shouldEndSession: false, sessionAttributes, expectSpeech: true }));
  }

  const history: ChatMessage[] = Array.isArray(sessionAttributes.history)
    ? (sessionAttributes.history as ChatMessage[])
    : [];
  history.push({ role: 'user', content: userText });

  let reply: string;
  try {
    reply = await chat(history.slice(-MAX_HISTORY));
  } catch (e) {
    reply = '调用模型时出错了：' + (e instanceof Error ? e.message : '未知错误');
  }

  history.push({ role: 'assistant', content: reply });
  const newAttrs: SkillSessionAttributes = {
    ...sessionAttributes,
    history: history.slice(-MAX_HISTORY),
  };

  // 默认保持会话打开，支持连续对话
  return NextResponse.json(
    buildDuerResponse({ text: reply, shouldEndSession: false, sessionAttributes: newAttrs, expectSpeech: true }),
  );
}
