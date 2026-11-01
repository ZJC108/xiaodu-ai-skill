// 构造 DuerOS BOT 协议响应（v2.0）

export const MAX_TTS_CHARS = 250; // 官网限制 outputSpeech.text ≤ 256，留余量

/** 截断到适合 TTS 朗读的长度（含省略号不超过 max），并补省略号。 */
export function truncateForTTS(text: string, max = MAX_TTS_CHARS): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

export interface DuerResponseOptions {
  text: string;
  shouldEndSession?: boolean;
  sessionAttributes?: Record<string, unknown>;
  expectSpeech?: boolean; // 仅当 shouldEndSession=false 时生效
}

export function buildDuerResponse(opts: DuerResponseOptions) {
  const { text, shouldEndSession = false, sessionAttributes = {}, expectSpeech } = opts;

  const response: Record<string, unknown> = {
    version: '2.0',
    session: { attributes: sessionAttributes },
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: truncateForTTS(text),
      },
      shouldEndSession,
    },
  };

  if (!shouldEndSession && typeof expectSpeech === 'boolean') {
    (response.response as Record<string, unknown>).expectSpeech = expectSpeech;
  }

  return response;
}
