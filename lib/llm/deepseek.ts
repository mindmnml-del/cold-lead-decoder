export const DEEPSEEK_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CreateRequest = {
  model: string;
  messages: ChatMessage[];
  response_format?: { type: "json_object" };
  max_tokens?: number;
};

export type CreateResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

export type CreateFn = (req: CreateRequest) => Promise<CreateResponse>;

export interface CallDeepSeekOpts {
  create: CreateFn;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CallDeepSeekResult {
  raw: string;
}

export declare function callDeepSeek(
  opts: CallDeepSeekOpts,
): Promise<CallDeepSeekResult>;
