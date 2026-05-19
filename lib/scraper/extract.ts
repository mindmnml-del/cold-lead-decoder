import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { safeFetch, type Fetcher, type Resolver } from "./fetch";

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

const THIN_THRESHOLD = 600;
const TEXT_BUDGET = 12000;

const defaultReadabilityExtractor: ReadabilityExtractor = (html, url) => {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  return article?.textContent?.trim() ?? null;
};

const defaultCheerioExtractor: CheerioExtractor = (html) => {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
};

function extractText(
  html: string,
  url: string,
  readability: ReadabilityExtractor,
  cheerioExtract: CheerioExtractor,
): string {
  try {
    const r = readability(html, url);
    if (r && r.length > 0) return r;
  } catch {
    // fall through to cheerio
  }
  return cheerioExtract(html);
}

export async function scrapeSite(
  url: string,
  opts: ScrapeSiteOpts = {},
): Promise<ScrapeResult> {
  const fetcher = opts.fetcher;
  const resolver = opts.resolver;
  const readability = opts.readabilityExtractor ?? defaultReadabilityExtractor;
  const cheerioExtract = opts.cheerioExtractor ?? defaultCheerioExtractor;

  const pages: string[] = [];

  const homepageRes = await safeFetch(url, { fetcher, resolver });
  const homepageHtml = await homepageRes.text();
  pages.push(url);

  const homepageText = extractText(homepageHtml, url, readability, cheerioExtract);

  let aboutText = "";
  if (homepageText.length < THIN_THRESHOLD) {
    const aboutUrl = new URL("/about", url).toString();
    try {
      const aboutRes = await safeFetch(aboutUrl, { fetcher, resolver });
      const aboutHtml = await aboutRes.text();
      aboutText = extractText(aboutHtml, aboutUrl, readability, cheerioExtract);
      pages.push(aboutUrl);
    } catch {
      // swallow: thin homepage + failed /about ⇒ degraded, not abort (ADR-008)
    }
  }

  const combined = aboutText ? homepageText + "\n\n" + aboutText : homepageText;
  const finalText = combined.length > TEXT_BUDGET ? combined.slice(0, TEXT_BUDGET) : combined;
  const degraded = finalText.length < THIN_THRESHOLD;

  return { text: finalText, pages, degraded };
}
