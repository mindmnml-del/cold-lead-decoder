"use client";

import { useCallback, useState } from "react";
import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";
import { DecodeError } from "./DecodeError";

export interface DomainFormProps {
  onSuccess?: (card: LeadCardData) => void;
  onLoadingChange?: (loading: boolean) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "field_error"; message: string }
  | { kind: "decode_error"; reason: "fetch_blocked" | "decode_failed" }
  | { kind: "success" };

const FIELD_ERROR = "Enter a valid domain like acme.com";

function isLikelyDomain(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.includes(".") && !/\s/.test(trimmed);
}

function ArrowIcon({ size = 12 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function DomainForm({
  onSuccess,
  onLoadingChange,
}: DomainFormProps = {}): JSX.Element {
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const runDecode = useCallback(
    async (target: string) => {
      setStatus({ kind: "loading" });
      onLoadingChange?.(true);
      try {
        const res = await fetch("/api/decode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: target }),
        });
        const body = (await res.json()) as
          | LeadCardData
          | {
              reason: "invalid_domain" | "fetch_blocked" | "decode_failed";
              message: string;
            };

        if (res.ok) {
          setStatus({ kind: "success" });
          onSuccess?.(body as LeadCardData);
          return;
        }

        const reason = (body as { reason: string }).reason;
        if (reason === "invalid_domain") {
          setStatus({ kind: "field_error", message: FIELD_ERROR });
        } else if (reason === "fetch_blocked" || reason === "decode_failed") {
          setStatus({ kind: "decode_error", reason });
        } else {
          setStatus({ kind: "decode_error", reason: "decode_failed" });
        }
      } catch {
        setStatus({ kind: "decode_error", reason: "decode_failed" });
      } finally {
        onLoadingChange?.(false);
      }
    },
    [onSuccess, onLoadingChange],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLikelyDomain(domain)) {
      setStatus({ kind: "field_error", message: FIELD_ERROR });
      return;
    }
    void runDecode(domain.trim());
  };

  const handleRetry = () => {
    void runDecode(domain.trim());
  };

  const isLoading = status.kind === "loading";
  const hasFieldError = status.kind === "field_error";

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <label
          htmlFor="domain"
          className="block font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500"
        >
          Company domain
        </label>
        <div className="mt-2.5 flex gap-2">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-neutral-600"
            >
              https://
            </span>
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={hasFieldError || undefined}
              aria-describedby={hasFieldError ? "domain-error" : "domain-hint"}
              className={`w-full rounded-lg border bg-neutral-900/40 py-2.5 pl-[72px] pr-3 font-mono text-[13.5px] text-neutral-100 placeholder-neutral-700 transition focus:outline-none focus:ring-2 disabled:opacity-60 ${
                hasFieldError
                  ? "border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20"
                  : "border-neutral-800 focus:border-neutral-700 focus:ring-amber-400/15"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            aria-label="Decode"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-50 px-5 py-2.5 text-[13px] font-medium text-neutral-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300/40 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950"
                />
                Decoding…
              </>
            ) : (
              <>
                Decode <ArrowIcon />
              </>
            )}
          </button>
        </div>
        {hasFieldError ? (
          <p
            id="domain-error"
            className="mt-2.5 font-mono text-[11.5px] text-red-400"
          >
            {status.message}
          </p>
        ) : (
          <p
            id="domain-hint"
            className="mt-2.5 font-mono text-[11px] text-neutral-600"
          >
            Press Enter · ~12s typical · public site only
          </p>
        )}
      </form>

      {status.kind === "loading" ? (
        <div className="mt-8">
          <LeadCardSkeleton />
        </div>
      ) : null}

      {status.kind === "decode_error" ? (
        <div className="mt-8">
          <DecodeError
            reason={status.reason}
            onRetry={status.reason === "decode_failed" ? handleRetry : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function SkBar({
  w,
  h = 10,
  className = "",
}: {
  w: number | string;
  h?: number;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-800/60 ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

function LeadCardSkeleton(): JSX.Element {
  return (
    <article
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-neutral-800/70 bg-neutral-900/40 p-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 animate-pulse rounded-xl bg-neutral-800/60" />
          <div className="space-y-2.5">
            <SkBar w={160} h={14} />
            <SkBar w={120} h={10} />
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-600">
          Decoding…
        </div>
      </div>
      <div className="mt-6 space-y-2.5">
        <SkBar w="100%" h={11} />
        <SkBar w="92%" h={11} />
        <SkBar w="64%" h={11} />
      </div>
      <div className="mt-7 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-neutral-800/60 pt-7 md:grid-cols-2">
        <div className="space-y-3">
          <SkBar w={110} h={9} />
          <SkBar w="100%" h={10} />
          <SkBar w="86%" h={10} />
          <SkBar w="72%" h={10} />
        </div>
        <div className="space-y-3">
          <SkBar w={110} h={9} />
          <SkBar w="100%" h={10} />
          <SkBar w="78%" h={10} />
        </div>
      </div>
      <div className="mt-7 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-6">
        <SkBar w={130} h={9} className="!bg-amber-500/20" />
        <div className="mt-4 space-y-2.5">
          <SkBar w="100%" h={12} className="!bg-amber-500/15" />
          <SkBar w="90%" h={12} className="!bg-amber-500/15" />
          <SkBar w="55%" h={12} className="!bg-amber-500/15" />
        </div>
      </div>
      <span className="sr-only">Decoding…</span>
    </article>
  );
}
