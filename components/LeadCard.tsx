import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";

export interface LeadCardProps {
  card: LeadCardData;
}

export function LeadCard(_props: LeadCardProps): JSX.Element {
  throw new Error("Not Implemented: LeadCard");
}
