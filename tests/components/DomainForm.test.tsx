import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DomainForm } from "../../components/DomainForm";
import { validLeadCard } from "../fixtures/leadCard";

function mkFetchResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function neverResolves(): Promise<Response> {
  return new Promise<Response>(() => {
    /* pending forever */
  });
}

async function typeAndSubmit(user: ReturnType<typeof userEvent.setup>, domain: string) {
  const input = screen.getByRole("textbox");
  await user.clear(input);
  await user.type(input, domain);
  const submit = screen.getByRole("button", { name: /decode/i });
  await user.click(submit);
}

describe("DomainForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("[LOADING] shows skeleton and disables submit while POST is in-flight", async () => {
    fetchMock.mockReturnValue(neverResolves());
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "acme.com");

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /decode/i })).toBeDisabled();
  });

  it("[HTTP 400] shows inline field error and keeps form visible; no card replaces it", async () => {
    fetchMock.mockResolvedValue(
      mkFetchResponse(400, {
        reason: "invalid_domain",
        message: "Body must be JSON with { domain }",
      }),
    );
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "acme.com");

    await waitFor(() => {
      expect(
        screen.getByText("Enter a valid domain like acme.com"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByTestId("decode-error")).toBeNull();
    expect(screen.queryByTestId("lead-card")).toBeNull();
  });

  it("[HTTP 403] renders DecodeError with 'Couldn't reach this site' and NO retry button", async () => {
    fetchMock.mockResolvedValue(
      mkFetchResponse(403, {
        reason: "fetch_blocked",
        message: "Blocked IP from DNS: evil.example -> 10.0.0.5",
      }),
    );
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "evil.example");

    await waitFor(() => {
      expect(screen.getByText("Couldn't reach this site")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("[HTTP 500] renders DecodeError with retry button that re-fires POST", async () => {
    fetchMock.mockResolvedValue(
      mkFetchResponse(500, {
        reason: "decode_failed",
        message: "boom",
      }),
    );
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "acme.com");

    await waitFor(() => {
      expect(
        screen.getByText("Decode failed, try another domain"),
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("[HTTP 429] renders DecodeError with rate_limited copy and NO retry button", async () => {
    fetchMock.mockResolvedValue(
      mkFetchResponse(429, {
        reason: "rate_limited",
        message: "Too many requests. Try again in a minute.",
      }),
    );
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "acme.com");

    await waitFor(() => {
      expect(screen.getByText("Too many requests")).toBeInTheDocument();
    });
    expect(screen.getByText(/try again in a minute/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("[CLIENT GUARD] rejects domain without a dot before any network call", async () => {
    const user = userEvent.setup();
    render(<DomainForm />);

    await typeAndSubmit(user, "localhost");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Enter a valid domain like acme.com"),
    ).toBeInTheDocument();
  });

  it("[SUCCESS] calls onSuccess with parsed LeadCard on 200", async () => {
    fetchMock.mockResolvedValue(mkFetchResponse(200, validLeadCard));
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<DomainForm onSuccess={onSuccess} />);

    await typeAndSubmit(user, "acme.com");

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess).toHaveBeenCalledWith(validLeadCard);
  });

  it("[CHIPS] renders example domain chips", () => {
    render(<DomainForm />);
    expect(
      screen.getByRole("button", { name: /stripe\.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /figma\.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /plausible\.io/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /geohub\.ge/i }),
    ).toBeInTheDocument();
  });

  it("[CHIPS] clicking a chip fills the input", async () => {
    const user = userEvent.setup();
    render(<DomainForm />);

    const chip = screen.getByRole("button", { name: /figma\.com/i });
    await user.click(chip);

    expect(screen.getByRole("textbox")).toHaveValue("figma.com");
  });

  it("[CHIPS] clicking a chip does NOT submit the form", async () => {
    const user = userEvent.setup();
    render(<DomainForm />);

    const chip = screen.getByRole("button", { name: /plausible\.io/i });
    await user.click(chip);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
