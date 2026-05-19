import { LeadCardSchema, type LeadCard } from "../../lib/schema/leadCard";

const base: LeadCard = {
  company_name: "Acme Robotics",
  domain: "acme.com",
  summary:
    "Acme Robotics builds collaborative warehouse robots for mid-market e-commerce fulfillment centers.",
  category: "Warehouse Automation",
  positioning_signals: [
    "Targets mid-market e-commerce, not hyperscalers",
    "Emphasizes deployment in under 30 days",
    "Strong focus on safety certifications",
  ],
  likely_pain_points: [
    "Labor shortages in regional fulfillment hubs",
    "Long ROI cycles on legacy automation",
  ],
  personalized_opener:
    "Saw your case study on the Memphis hub deploying in 21 days — curious how the safety review went with OSHA's new collaborative-robot guidance.",
  follow_up_angles: [
    "Compare deployment timelines vs. traditional AGV vendors",
    "Map OSHA collaborative-robot guidance onto current install base",
  ],
  confidence_notes: null,
  source_pages: ["https://acme.com/", "https://acme.com/about"],
  degraded: false,
  evidence: {
    opener_basis:
      "Acme's homepage hero touts a 21-day Memphis case study; their /about page references OSHA-aligned safety reviews.",
  },
};

const parsed = LeadCardSchema.safeParse(base);
if (!parsed.success) {
  throw new Error(
    `validLeadCard fixture drifted from schema: ${parsed.error.message}`,
  );
}

export const validLeadCard: LeadCard = parsed.data;

export function withOverrides(partial: Partial<LeadCard>): LeadCard {
  return LeadCardSchema.parse({ ...validLeadCard, ...partial });
}
