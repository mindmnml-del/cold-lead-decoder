export type OpenerGuardResult =
  | { valid: true }
  | { valid: false; note: string };

export type OpenerGuard = (opener: string) => OpenerGuardResult;

const BANNED_PHRASES = [
  "I hope this finds you well",
  "I came across your company",
  "as a leading provider",
] as const;

export const bannedPhraseGuard: OpenerGuard = (opener) => {
  const lower = opener.toLowerCase();
  const hit = BANNED_PHRASES.find((p) => lower.includes(p.toLowerCase()));
  if (hit) {
    return {
      valid: false,
      note: `Generic opener detected — banned phrase: "${hit}"`,
    };
  }
  return { valid: true };
};
