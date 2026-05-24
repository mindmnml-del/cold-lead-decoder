"use client";

export type DecodeErrorReason =
  | "fetch_blocked"
  | "decode_failed"
  | "rate_limited";

export interface DecodeErrorProps {
  reason: DecodeErrorReason;
  onRetry?: () => void;
}

const TITLES: Record<DecodeErrorReason, string> = {
  fetch_blocked: "Couldn't reach this site",
  decode_failed: "Decode failed, try another domain",
  rate_limited: "Too many requests",
};

const BODIES: Record<DecodeErrorReason, string> = {
  fetch_blocked:
    "The site didn't respond, blocked our request, or resolved to an internal address. Try another public domain.",
  decode_failed:
    "We pulled the page but couldn't extract a usable lead. This is usually a JS-heavy site or one with very little public copy.",
  rate_limited: "Too many requests — try again in a minute.",
};

function RetryIcon({ size = 12 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2v3h-3" />
    </svg>
  );
}

export function DecodeError({ reason, onRetry }: DecodeErrorProps): JSX.Element {
  const showRetry = reason === "decode_failed" && Boolean(onRetry);
  return (
    <div
      data-testid="decode-error"
      role="alert"
      className="relative overflow-hidden rounded-2xl border border-red-500/25 p-6"
      style={{
        background:
          "radial-gradient(130% 160% at 0% 0%, rgba(239,68,68,0.10) 0%, rgba(239,68,68,0.025) 45%, rgba(239,68,68,0) 75%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-red-300/90">
          {TITLES[reason]}
        </h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-red-50/90">
        {BODIES[reason]}
      </p>
      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/40 focus:ring-offset-2 focus:ring-offset-neutral-950"
        >
          <RetryIcon /> Retry decode
        </button>
      ) : null}
    </div>
  );
}
