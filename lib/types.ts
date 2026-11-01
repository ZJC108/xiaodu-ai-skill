// DuerOS BOT 协议（v2.0）请求类型定义（仅覆盖本技能所需字段）

export type RequestType = 'LaunchRequest' | 'IntentRequest' | 'SessionEndedRequest';

export interface DuerOSQuery {
  type?: string;
  original?: string;   // 用户实际说出的话（缺省意图下即为自由文本）
  rewritten?: string;  // 经过纠错的文本
}

export interface DuerOSIntent {
  name: string;         // 缺省意图为 "ai.dueros.common.default_intent"
  score?: number;
  confirmationStatus?: string;
  slots?: Record<string, unknown>;
}

export interface DuerOSRequest {
  version: string;
  session: {
    new: boolean;
    sessionId: string;
    attributes?: Record<string, unknown>;
  };
  context?: {
    System?: {
      user?: { userId?: string; accessToken?: string };
      application?: { applicationId?: string };
      device?: { deviceId?: string; supportedInterfaces?: Record<string, unknown> };
    };
  };
  request: {
    type: RequestType;
    requestId?: string;
    timestamp?: string;
    query?: DuerOSQuery;
    dialogState?: string;
    determined?: boolean;
    intents?: DuerOSIntent[];
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 对话历史存在 session.attributes.history 里，随多轮请求回传
export interface SkillSessionAttributes {
  history?: ChatMessage[];
  [key: string]: unknown;
}
