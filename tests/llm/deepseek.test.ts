import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  callDeepSeek,
  wrapRetry,
  type CreateFn,
  type CreateRequest,
  type CreateResponse,
} from "../../lib/llm/deepseek";

const mkResp = (content: string): CreateResponse => ({
  choices: [{ message: { content } }],
});

function mkOkCreate(content = "{}"): {
  create: ReturnType<
    typeof vi.fn<(req: CreateRequest) => Promise<CreateResponse>>
  >;
} {
  const create = vi.fn<(req: CreateRequest) => Promise<CreateResponse>>(
    async () => mkResp(content),
  );
  return { create };
}

class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
  }
}

describe("DeepSeek client — ADR-004 config", () => {
  it("D1: exports DEEPSEEK_MODEL === 'deepseek-chat'", () => {
    expect(DEEPSEEK_MODEL).toBe("deepseek-chat");
  });

  it("D2: exports DEEPSEEK_BASE_URL pointing at api.deepseek.com", () => {
    expect(DEEPSEEK_BASE_URL).toMatch(/api\.deepseek\.com/);
  });

  it("D3: callDeepSeek sends response_format: { type: 'json_object' }", async () => {
    const { create } = mkOkCreate("{}");
    await callDeepSeek({
      create: create as unknown as CreateFn,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(create).toHaveBeenCalledTimes(1);
    const req = create.mock.calls[0]![0];
    expect(req.response_format).toEqual({ type: "json_object" });
  });

  it("D4: callDeepSeek omits any thinking/reasoning fields (thinking disabled)", async () => {
    const { create } = mkOkCreate("{}");
    await callDeepSeek({
      create: create as unknown as CreateFn,
      messages: [{ role: "user", content: "hi" }],
    });
    const req = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(req).not.toHaveProperty("reasoning");
    expect(req).not.toHaveProperty("thinking");
    expect(req).not.toHaveProperty("enable_thinking");
  });

  it("D5: callDeepSeek forwards maxTokens to request as max_tokens", async () => {
    const { create } = mkOkCreate("{}");
    await callDeepSeek({
      create: create as unknown as CreateFn,
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 800,
    });
    const req = create.mock.calls[0]![0];
    expect(req.max_tokens).toBe(800);
  });

  it("D5b: callDeepSeek applies a default max_tokens cap when omitted", async () => {
    const { create } = mkOkCreate("{}");
    await callDeepSeek({
      create: create as unknown as CreateFn,
      messages: [{ role: "user", content: "hi" }],
    });
    const req = create.mock.calls[0]![0];
    expect(req.max_tokens).toBeTypeOf("number");
    expect(req.max_tokens!).toBeGreaterThan(0);
    expect(req.max_tokens!).toBeLessThanOrEqual(4096);
  });
});

describe("DeepSeek client — backoff (ADR-004)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("D6: retries on 429 with strictly increasing delays, then succeeds", async () => {
    const delays: number[] = [];
    const origSetTimeout = globalThis.setTimeout;
    const spy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((fn: () => void, ms?: number) => {
        if (typeof ms === "number") delays.push(ms);
        return origSetTimeout(fn, 0);
      }) as typeof globalThis.setTimeout);

    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockRejectedValueOnce(new HttpError(429))
      .mockRejectedValueOnce(new HttpError(429))
      .mockResolvedValueOnce(mkResp("{}"));

    const promise = callDeepSeek({
      create: create as unknown as CreateFn,
      messages: [{ role: "user", content: "hi" }],
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(create).toHaveBeenCalledTimes(3);
    expect(result.raw).toBe("{}");
    expect(delays.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    }

    spy.mockRestore();
  });

  it.each([500, 503] as const)(
    "D7: retries on HTTP %i",
    async (status) => {
      const origSetTimeout = globalThis.setTimeout;
      const spy = vi
        .spyOn(globalThis, "setTimeout")
        .mockImplementation(((fn: () => void) => {
          return origSetTimeout(fn, 0);
        }) as typeof globalThis.setTimeout);

      const create = vi
        .fn<(req: CreateRequest) => Promise<CreateResponse>>()
        .mockRejectedValueOnce(new HttpError(status))
        .mockResolvedValueOnce(mkResp("{}"));

      const promise = callDeepSeek({
        create: create as unknown as CreateFn,
        messages: [{ role: "user", content: "hi" }],
      });
      await vi.runAllTimersAsync();
      await promise;

      expect(create).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    },
  );

  it("D8: does NOT retry on HTTP 400", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockRejectedValueOnce(new HttpError(400));

    await expect(
      callDeepSeek({
        create: create as unknown as CreateFn,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBeInstanceOf(HttpError);

    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("createDeepSeekFn — retry wiring (ADR-004)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("[RETRY WIRING] CreateFn returned by wrapRetry retries on 429 then succeeds", async () => {
    const origSetTimeout = globalThis.setTimeout;
    const spy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((fn: () => void) => {
        return origSetTimeout(fn, 0);
      }) as typeof globalThis.setTimeout);

    const rawCreate = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockRejectedValueOnce(new HttpError(429))
      .mockResolvedValueOnce(mkResp("{}"));

    const fn: CreateFn = wrapRetry(rawCreate as unknown as CreateFn);
    const promise = fn({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: "hi" }],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(rawCreate).toHaveBeenCalledTimes(2);
    expect(result.choices[0]!.message.content).toBe("{}");

    spy.mockRestore();
  });
});
