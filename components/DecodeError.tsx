"use client";

export type DecodeErrorReason = "fetch_blocked" | "decode_failed";

export interface DecodeErrorProps {
  reason: DecodeErrorReason;
  message?: string;
  onRetry?: () => void;
}

const CANONICAL: Record<DecodeErrorReason, string> = {
  fetch_blocked: "Couldn't reach this site",
  decode_failed: "Decode failed, try another domain",
};

export function DecodeError({ reason, onRetry }: DecodeErrorProps): JSX.Element {
  const showRetry = reason === "decode_failed";
  return (
    <div
      data-testid="decode-error"
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
    >
      <p className="font-medium">{CANONICAL[reason]}</p>
      {showRetry && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
