import { describe, expect, it, vi } from "vitest";
import { scrapeSite } from "../../lib/scraper/extract";
import type { Fetcher, Resolver } from "../../lib/scraper/fetch";

const publicResolver: Resolver = async () => ["8.8.8.8"];

function makeFetcher(responses: Record<string, { status: number; body: string }>): {
  fetcher: Fetcher;
  calls: string[];
} {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const r = responses[url] ?? { status: 404, body: "" };
    return new Response(r.body, {
      status: r.status,
      headers: { "content-type": "text/html" },
    });
  };
  return { fetcher, calls };
}

describe("scrapeSite — Readability success path (ADR-003)", () => {
  it("returns cleaned main text from homepage, nav/footer stripped", async () => {
    const html = `<html><body>
      <nav>Home About Contact</nav>
      <main><h1>Acme Robotics</h1><p>${"We build industrial robotic arms for warehouses. ".repeat(20)}</p></main>
      <footer>© 2026 Acme</footer>
    </body></html>`;
    const cleaned =
      "Acme Robotics. " +
      "We build industrial robotic arms for warehouses. ".repeat(20);
    const { fetcher, calls } = makeFetcher({
      "https://acme.example/": { status: 200, body: html },
    });
    const cheerioExtractor = vi.fn(() => "SHOULD NOT BE USED");

    const result = await scrapeSite("https://acme.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => cleaned,
      cheerioExtractor,
    });

    expect(result.text).toContain("Acme Robotics");
    expect(result.text).toContain("industrial robotic arms");
    expect(result.text).not.toContain("Home About Contact");
    expect(result.text).not.toContain("© 2026 Acme");
    expect(result.pages).toEqual(["https://acme.example/"]);
    expect(result.degraded).toBe(false);
    expect(calls).toEqual(["https://acme.example/"]);
    expect(cheerioExtractor).not.toHaveBeenCalled();
  });
});

describe("scrapeSite — Cheerio fallback when Readability fails (ADR-003)", () => {
  it("falls back to cheerioExtractor when readabilityExtractor returns null", async () => {
    const html = `<html><body><div>Raw fallback content. ${"x".repeat(700)}</div></body></html>`;
    const cheerioText = "Raw fallback content. " + "x".repeat(700);
    const { fetcher } = makeFetcher({
      "https://spa.example/": { status: 200, body: html },
    });
    const cheerioExtractor = vi.fn(() => cheerioText);

    const result = await scrapeSite("https://spa.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => null,
      cheerioExtractor,
    });

    expect(cheerioExtractor).toHaveBeenCalledTimes(1);
    expect(cheerioExtractor).toHaveBeenCalledWith(html);
    expect(result.text).toContain("Raw fallback content");
    expect(result.degraded).toBe(false);
  });

  it("falls back to cheerioExtractor when readabilityExtractor returns empty string", async () => {
    const html = `<html><body><p>Body content here. ${"y".repeat(700)}</p></body></html>`;
    const cheerioText = "Body content here. " + "y".repeat(700);
    const { fetcher } = makeFetcher({
      "https://spa2.example/": { status: 200, body: html },
    });
    const cheerioExtractor = vi.fn(() => cheerioText);

    const result = await scrapeSite("https://spa2.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => "",
      cheerioExtractor,
    });

    expect(cheerioExtractor).toHaveBeenCalled();
    expect(result.text).toContain("Body content here");
  });

  it("falls back to cheerioExtractor when readabilityExtractor throws", async () => {
    const html = `<html><body><article>Article body. ${"z".repeat(700)}</article></body></html>`;
    const cheerioText = "Article body. " + "z".repeat(700);
    const { fetcher } = makeFetcher({
      "https://throws.example/": { status: 200, body: html },
    });
    const cheerioExtractor = vi.fn(() => cheerioText);

    const result = await scrapeSite("https://throws.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => {
        throw new Error("Readability blew up on this DOM");
      },
      cheerioExtractor,
    });

    expect(cheerioExtractor).toHaveBeenCalled();
    expect(result.text).toContain("Article body");
  });
});

describe("scrapeSite — Thin-content flow fetches /about (architecture §4 step 5)", () => {
  it("fetches /about when homepage usable text is < 600 chars", async () => {
    const { fetcher, calls } = makeFetcher({
      "https://thin.example/": { status: 200, body: "<html><body>tiny</body></html>" },
      "https://thin.example/about": {
        status: 200,
        body: "<html><body>about</body></html>",
      },
    });
    const readabilityExtractor = (html: string) => {
      if (html.includes("tiny")) return "Short homepage text";
      if (html.includes("about"))
        return "About page detail. " + "a".repeat(700);
      return null;
    };

    const result = await scrapeSite("https://thin.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor,
      cheerioExtractor: () => "",
    });

    expect(calls).toContain("https://thin.example/about");
    expect(result.pages).toContain("https://thin.example/about");
    expect(result.text).toContain("About page detail");
    expect(result.degraded).toBe(false);
  });

  it("does NOT fetch /about when homepage already has ≥ 600 chars", async () => {
    const homepageText = "Plenty of homepage content. " + "b".repeat(700);
    const { fetcher, calls } = makeFetcher({
      "https://rich.example/": {
        status: 200,
        body: "<html><body>rich</body></html>",
      },
      "https://rich.example/about": {
        status: 200,
        body: "<html><body>about</body></html>",
      },
    });

    const result = await scrapeSite("https://rich.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => homepageText,
      cheerioExtractor: () => "",
    });

    expect(calls).toEqual(["https://rich.example/"]);
    expect(calls).not.toContain("https://rich.example/about");
    expect(result.pages).toEqual(["https://rich.example/"]);
    expect(result.degraded).toBe(false);
  });
});

describe("scrapeSite — truncation to 12,000 characters (architecture §4 step 6)", () => {
  it("caps combined text at exactly 12,000 characters when extractor returns more", async () => {
    const longText = "a".repeat(20000);
    const { fetcher } = makeFetcher({
      "https://huge.example/": {
        status: 200,
        body: "<html><body>huge</body></html>",
      },
    });

    const result = await scrapeSite("https://huge.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => longText,
      cheerioExtractor: () => "",
    });

    expect(result.text.length).toBe(12000);
    expect(result.degraded).toBe(false);
  });

  it("front-loads the homepage when truncating homepage+/about combined output", async () => {
    const homepageText = "HOMEPAGE_MARKER " + "h".repeat(300); // < 600 → triggers /about
    const aboutText = "ABOUT_MARKER " + "x".repeat(20000); // huge
    const { fetcher } = makeFetcher({
      "https://combo.example/": {
        status: 200,
        body: "<html><body>home</body></html>",
      },
      "https://combo.example/about": {
        status: 200,
        body: "<html><body>about</body></html>",
      },
    });
    const readabilityExtractor = (html: string) => {
      if (html.includes("home")) return homepageText;
      if (html.includes("about")) return aboutText;
      return null;
    };

    const result = await scrapeSite("https://combo.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor,
      cheerioExtractor: () => "",
    });

    expect(result.text.length).toBeLessThanOrEqual(12000);
    expect(result.text).toContain("HOMEPAGE_MARKER");
  });
});

describe("scrapeSite — degraded flag when still thin after /about (architecture §4 step 5)", () => {
  it("sets degraded=true when combined text < 600 chars after /about attempt", async () => {
    const { fetcher, calls } = makeFetcher({
      "https://stub.example/": {
        status: 200,
        body: "<html><body>thin</body></html>",
      },
      "https://stub.example/about": {
        status: 200,
        body: "<html><body>also thin</body></html>",
      },
    });

    const result = await scrapeSite("https://stub.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => "short",
      cheerioExtractor: () => "still short",
    });

    expect(calls).toContain("https://stub.example/about");
    expect(result.degraded).toBe(true);
    expect(result.pages).toContain("https://stub.example/");
  });

  it("sets degraded=true when /about fetch fails (network error) and homepage stays thin", async () => {
    const fetcher: Fetcher = async (url) => {
      if (url === "https://err.example/") {
        return new Response("<html><body>thin</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      throw new Error("Network failure on /about");
    };

    const result = await scrapeSite("https://err.example/", {
      fetcher,
      resolver: publicResolver,
      readabilityExtractor: () => "short",
      cheerioExtractor: () => "short",
    });

    expect(result.degraded).toBe(true);
  });
});
