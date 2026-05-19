import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DecodeError,
  type DecodeErrorReason,
} from "../../components/DecodeError";

interface Row {
  reason: DecodeErrorReason;
  message: string;
  retryExpected: boolean;
}

const rows: Row[] = [
  {
    reason: "fetch_blocked",
    message: "Couldn't reach this site",
    retryExpected: false,
  },
  {
    reason: "decode_failed",
    message: "Decode failed, try another domain",
    retryExpected: true,
  },
];

describe("DecodeError", () => {
  it.each(rows)(
    "renders message and retry button correctly for $reason",
    ({ reason, message, retryExpected }) => {
      const onRetry = vi.fn();
      render(<DecodeError reason={reason} onRetry={onRetry} />);

      expect(screen.getByText(message)).toBeInTheDocument();

      const retryButton = screen.queryByRole("button", { name: /retry/i });
      if (retryExpected) {
        expect(retryButton).not.toBeNull();
      } else {
        expect(retryButton).toBeNull();
      }
    },
  );

  it("calls onRetry exactly once when retry button is clicked (decode_failed)", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DecodeError reason="decode_failed" onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
