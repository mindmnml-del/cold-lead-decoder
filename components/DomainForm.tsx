import type { LeadCard } from "../lib/schema/leadCard";

export interface DomainFormProps {
  onSuccess?: (card: LeadCard) => void;
}

export function DomainForm(_props: DomainFormProps = {}): JSX.Element {
  throw new Error("Not Implemented: DomainForm");
}
