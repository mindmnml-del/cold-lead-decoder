/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "jsdom",
      "@mozilla/readability",
      "html-encoding-sniffer",
      "@exodus/bytes",
      "whatwg-encoding",
      "cheerio",
    ],
  },
};

export default nextConfig;
