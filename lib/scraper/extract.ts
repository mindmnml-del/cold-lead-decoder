import type { Fetcher, Resolver } from "./fetch";

export type ReadabilityExtractor = (html: string, url: string) => string | null;
export type CheerioExtractor = (html: string) => string;

export interface ScrapeSiteOpts {
  fetcher?: Fetcher;
  resolver?: Resolver;
  readabilityExtractor?: ReadabilityExtractor;
  cheerioExtractor?: CheerioExtractor;
}

export interface ScrapeResult {
  text: string;
  pages: string[];
  degraded: boolean;
}

export async function scrapeSite(
  _url: string,
  _opts: ScrapeSiteOpts = {},
): Promise<ScrapeResult> {
  throw new Error("scrapeSite not implemented (RED phase)");
}
