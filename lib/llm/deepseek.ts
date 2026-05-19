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

const DEFAULT_MAX_TOKENS = 1500;
const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

export async function callDeepSeek(
  opts: CallDeepSeekOpts,
): Promise<CallDeepSeekResult> {
  const req: CreateRequest = {
    model: DEEPSEEK_MODEL,
    messages: opts.messages,
    response_format: { type: "json_object" },
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  let attempt = 0;
  for (;;) {
    try {
      const res = await opts.create(req);
      return { raw: res.choices?.[0]?.message?.content ?? "" };
    } catch (err) {
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status?: unknown }).status
          : undefined;
      const retryable =
        typeof status === "number" && RETRYABLE_STATUSES.has(status);
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

export function createDeepSeekFn(apiKey: string): CreateFn {
  // Lazy require so test runtime never touches the openai package.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { OpenAI } = require("openai") as typeof import("openai");
  const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
  return async (req: CreateRequest): Promise<CreateResponse> => {
    const completion = await client.chat.completions.create({
      model: req.model,
      messages: req.messages,
      response_format: req.response_format,
      max_tokens: req.max_tokens,
      // DeepSeek-specific: forwarded via OpenAI SDK's extra-body passthrough.
      // @ts-expect-error extra_body is provider-specific
      extra_body: { thinking: { type: "disabled" } },
    });
    return completion as unknown as CreateResponse;
  };
}
