export type OpenerGuardResult =
  | { valid: true }
  | { valid: false; note: string };

export type OpenerGuard = (opener: string) => OpenerGuardResult;

export const bannedPhraseGuard: OpenerGuard = () => {
  throw new Error("Not Implemented");
};
