export type DecodeErrorReason = "fetch_blocked" | "decode_failed";

export interface DecodeErrorProps {
  reason: DecodeErrorReason;
  message?: string;
  onRetry?: () => void;
}

export function DecodeError(_props: DecodeErrorProps): JSX.Element {
  throw new Error("Not Implemented: DecodeError");
}
