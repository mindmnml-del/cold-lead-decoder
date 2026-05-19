import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadCard } from "../../components/LeadCard";
import { validLeadCard, withOverrides } from "../fixtures/leadCard";

describe("LeadCard", () => {
  it("[SUCCESS] renders personalized_opener and evidence.opener_basis", () => {
    render(<LeadCard card={validLeadCard} />);

    expect(screen.getByText(validLeadCard.personalized_opener)).toBeInTheDocument();
    expect(
      screen.getByText(validLeadCard.evidence.opener_basis),
    ).toBeInTheDocument();
  });

  it("[DEGRADED] shows 'Based on limited public info' badge when degraded is true", () => {
    const card = withOverrides({ degraded: true });
    render(<LeadCard card={card} />);

    expect(screen.getByText("Based on limited public info")).toBeInTheDocument();
  });

  it("[COPY] copy button writes personalized_opener to clipboard", async () => {
    const user = userEvent.setup();
    render(<LeadCard card={validLeadCard} />);

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await user.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      validLeadCard.personalized_opener,
    );
  });
});
