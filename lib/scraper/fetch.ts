export type Resolver = (host: string) => Promise<{ address: string; family: 4 | 6 }>;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface SafeFetchOpts {
  resolver?: Resolver;
  fetcher?: Fetcher;
  maxRedirects?: number;
}

export function isBlockedIp(_ip: string): boolean {
  throw new Error("not implemented");
}

export function assertSafeUrl(_url: string, _resolver?: Resolver): Promise<void> {
  throw new Error("not implemented");
}

export function safeFetch(_url: string, _opts?: SafeFetchOpts): Promise<Response> {
  throw new Error("not implemented");
}
