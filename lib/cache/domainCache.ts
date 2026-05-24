import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, unknown>({
  max: 500,
  ttl: 86_400_000,
});

export function getCached(domain: string): unknown {
  return cache.get(domain);
}

export function setCached(domain: string, data: unknown): void {
  cache.set(domain, data);
}

export function __resetCacheForTests(): void {
  cache.clear();
}
