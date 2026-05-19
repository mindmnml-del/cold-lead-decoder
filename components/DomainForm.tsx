"use client";

import { useCallback, useState } from "react";
import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";
import { DecodeError } from "./DecodeError";

export interface DomainFormProps {
  onSuccess?: (card: LeadCardData) => void;
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

export function DomainForm({ onSuccess }: DomainFormProps = {}): JSX.Element {
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const runDecode = useCallback(
    async (target: string) => {
      setStatus({ kind: "loading" });
      try {
        const res = await fetch("/api/decode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: target }),
        });
        const body = (await res.json()) as
          | LeadCardData
          | { reason: "invalid_domain" | "fetch_blocked" | "decode_failed"; message: string };

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
      }
    },
    [onSuccess],
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

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-slate-700">
          Company domain
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Decode
          </button>
        </div>
        {status.kind === "field_error" ? (
          <p className="mt-2 text-sm text-red-600">{status.message}</p>
        ) : null}
      </div>

      {status.kind === "loading" ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
          <span className="sr-only">Decoding…</span>
        </div>
      ) : null}

      {status.kind === "decode_error" ? (
        <DecodeError
          reason={status.reason}
          onRetry={status.reason === "decode_failed" ? handleRetry : undefined}
        />
      ) : null}
    </form>
  );
}
